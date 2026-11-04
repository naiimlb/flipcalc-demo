import { z } from "zod";

/**
 * Format de conception renvoyé par l'IA (et par le générateur de démo).
 * Unités : millimètres, axe Y vers le haut, le sol est à y = 0, angles en degrés.
 *
 * Le même objet sert à :
 *  - afficher la fiche (analyse, dimensions, matériaux, étapes, coût…) ;
 *  - construire la scène 3D (liste `model.parts`) ;
 *  - exporter en GLB / STL.
 */

export const SHAPES = ["box", "cylinder", "tube", "cone", "sphere", "torus", "capsule", "extrusion"] as const;
export const MATERIALS = ["plastic", "metal", "wood", "glass", "rubber", "fabric", "ceramic"] as const;
export const DIFFICULTIES = ["facile", "moyen", "avancé"] as const;

export type Shape = (typeof SHAPES)[number];
/** Bibliothèque de matières de l'éditeur (aspect réaliste ; la matière « material » reste celle des exports). */
export const FINISHES = ["pla", "petg", "abs", "resin", "wood", "metal", "glass", "rubber"] as const;
export type Finish = (typeof FINISHES)[number];
export type MaterialKind = (typeof MATERIALS)[number];

export const LIMITS = {
  maxParts: 60,
  // Relevés en phase 3 de la refonte : texte (contours de lettres) et formes libres tracées au doigt.
  maxProfilePoints: 160,
  maxHoles: 24,
  maxCoord: 5000, // mm
  minSize: 0.5, // mm
  maxSize: 5000, // mm
  maxText: 1200,
  maxList: 12,
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

const text = (max: number = LIMITS.maxText) =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max));

const list = (max: number = LIMITS.maxList, itemMax = 400) =>
  z.array(text(itemMax)).transform((arr) => arr.filter(Boolean).slice(0, max));

const finite = z.number().finite();
const clamp = (min: number, max: number) => finite.transform((n) => Math.min(max, Math.max(min, n)));

const vec3 = (min: number, max: number) =>
  z.object({ x: clamp(min, max), y: clamp(min, max), z: clamp(min, max) });

const point2 = z.object({ x: clamp(-LIMITS.maxCoord, LIMITS.maxCoord), y: clamp(-LIMITS.maxCoord, LIMITS.maxCoord) });

const color = z
  .string()
  .transform((s) => s.trim())
  .transform((s) => (HEX.test(s) ? s.toLowerCase() : "#8b8bf5"));

/** Matière conseillée pour fabriquer la solution (classées de la plus à la moins recommandée). */
export const RecommendedMaterialSchema = z.object({
  nom: text(60),
  pourquoi: text(400),
  limites: text(400),
  cout_approx: text(80),
  cout_indicatif: clamp(0, 1_000_000),
  procede: text(120),
  couleur: color,
  aspect: z.enum(MATERIALS),
  alternative_economique: z.boolean(),
});
export type RecommendedMaterial = z.output<typeof RecommendedMaterialSchema>;

export const MaterialCriteriaSchema = z.object({
  usage: text(80),
  charge: text(120),
  chaleur: text(120),
  contact_alimentaire: z.boolean(),
  budget: text(80),
  fabrication: text(120),
});

export const PartSchema = z.object({
  id: text(40),
  name: text(80),
  role: text(200),
  shape: z.enum(SHAPES),
  size: vec3(LIMITS.minSize, LIMITS.maxSize),
  position: vec3(-LIMITS.maxCoord, LIMITS.maxCoord),
  rotation: vec3(-360, 360),
  cornerRadius: clamp(0, 500),
  profile: z.array(point2).transform((pts) => pts.slice(0, LIMITS.maxProfilePoints)),
  holes: z
    .array(z.array(point2).transform((pts) => pts.slice(0, LIMITS.maxProfilePoints)))
    .transform((h) => h.filter((ring) => ring.length >= 3).slice(0, LIMITS.maxHoles)),
  color,
  material: z.enum(MATERIALS),
  // Éditeur (refonte phase 3), facultatifs : assemblage, verrou, finition de la bibliothèque de matières.
  group: z
    .string()
    .transform((s) => s.trim().slice(0, 40))
    .optional(),
  locked: z.boolean().optional(),
  finish: z.enum(FINISHES).optional(),
});

export const DesignSchema = z.object({
  title: text(120),
  category: text(60),
  difficulty: z.enum(DIFFICULTIES),
  analysis: z.object({
    summary: text(),
    needs: list(),
    constraints: list(),
    assumptions: list(),
  }),
  solution: z.object({
    concept: text(),
    howItWorks: text(),
    keyFeatures: list(),
  }),
  dimensions: z.object({
    width: clamp(0, 100000),
    depth: clamp(0, 100000),
    height: clamp(0, 100000),
    weightGrams: clamp(0, 1_000_000),
    notes: text(400),
  }),
  materials: z
    .array(
      z.object({
        name: text(80),
        usage: text(200),
        quantity: text(80),
        color,
      }),
    )
    .transform((m) => m.slice(0, LIMITS.maxList)),
  fabrication: z
    .array(
      z.object({
        title: text(120),
        detail: text(600),
        tool: text(80),
        durationMin: clamp(0, 100000).transform(Math.round),
      }),
    )
    .transform((s) => s.slice(0, 16)),
  cost: z.object({
    currency: text(8),
    min: clamp(0, 1_000_000),
    max: clamp(0, 1_000_000),
    items: z
      .array(z.object({ label: text(120), amount: clamp(0, 1_000_000) }))
      .transform((i) => i.slice(0, LIMITS.maxList)),
    notes: text(400),
  }),
  recommendations: list(),
  // Ajoutés en v2 : valeurs par défaut pour relire les anciennes conceptions.
  criteres_materiaux: MaterialCriteriaSchema.nullable().default(null),
  materiaux_conseilles: z
    .array(RecommendedMaterialSchema)
    .transform((m) => m.filter((x) => x.nom).slice(0, 6))
    .default([]),
  model: z.object({
    parts: z
      .array(PartSchema)
      .min(1, "Le modèle 3D doit contenir au moins une pièce.")
      .transform((parts) => parts.slice(0, LIMITS.maxParts)),
  }),
  // Ajouté en phase 2 : version dérivée d'une autre conception (« Plus petit », « Plus solide »…).
  // Renseigné par le serveur, jamais demandé à l'IA.
  variante: z
    .object({
      objectif: z.enum(["smaller", "stronger", "cheaper", "prettier"]),
      libelle: text(40),
      base: text(120),
    })
    .nullable()
    .default(null),
});

export type Design = z.output<typeof DesignSchema>;
export type Part = Design["model"]["parts"][number];
export type DesignInput = z.input<typeof DesignSchema>;

export type ValidationResult =
  | { ok: true; design: Design }
  | { ok: false; errors: string[] };

/** Valide et normalise (bornes, couleurs, longueurs) une conception venant de l'IA. */
export function validateDesign(value: unknown): ValidationResult {
  const parsed = DesignSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`),
    };
  }
  const design = parsed.data;
  // Identifiants de pièces uniques (la visionneuse s'en sert comme clés).
  const seen = new Set<string>();
  design.model.parts.forEach((part, index) => {
    let id = part.id || `piece-${index + 1}`;
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    part.id = id;
    if (!part.name) part.name = `Pièce ${index + 1}`;
    if (part.shape === "extrusion" && part.profile.length < 3) {
      // Profil absent : on retombe sur un pavé de la même taille.
      part.shape = "box";
    }
  });
  if (design.cost.max < design.cost.min) design.cost.max = design.cost.min;
  normalizeRecommendedMaterials(design.materiaux_conseilles);
  if (!design.cost.currency) design.cost.currency = "EUR";
  return { ok: true, design };
}

/**
 * Une seule « alternative économique » : la première signalée, sinon la moins chère
 * après la matière recommandée (jamais la recommandée elle-même s'il y a un choix).
 */
export function normalizeRecommendedMaterials(list: RecommendedMaterial[]) {
  if (list.length === 0) return;
  let found = false;
  for (const m of list) {
    if (m.alternative_economique && !found) found = true;
    else m.alternative_economique = false;
  }
  if (!found && list.length > 1) {
    const rest = list.slice(1);
    const cheapest = rest.reduce((a, b) => (b.cout_indicatif < a.cout_indicatif ? b : a));
    if (cheapest.cout_indicatif < list[0].cout_indicatif) cheapest.alternative_economique = true;
  }
}

/** Extrait le premier objet JSON d'un texte (au cas où le modèle ajoute du texte autour). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Aucun objet JSON trouvé dans la réponse.");
  }
}

/* ------------------------------------------------------------------ */
/* JSON Schema envoyé à l'API Claude (sorties structurées).            */
/* Contraintes : additionalProperties:false partout, pas de min/max.  */
/* ------------------------------------------------------------------ */

const S = {
  str: (description?: string) => ({ type: "string", ...(description ? { description } : {}) }),
  num: (description?: string) => ({ type: "number", ...(description ? { description } : {}) }),
  int: (description?: string) => ({ type: "integer", ...(description ? { description } : {}) }),
  arr: (items: object, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) }),
  obj: (properties: Record<string, object>, description?: string) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...(description ? { description } : {}),
  }),
  enumOf: (values: readonly string[], description?: string) => ({
    type: "string",
    enum: [...values],
    ...(description ? { description } : {}),
  }),
};

const xyz = (description: string) => S.obj({ x: S.num(), y: S.num(), z: S.num() }, description);
const xy = S.obj({ x: S.num(), y: S.num() });

export const DESIGN_JSON_SCHEMA = S.obj({
  title: S.str("Nom court de la solution (3 à 6 mots)."),
  category: S.str("Catégorie : rangement, support, outil, mobilier, accessoire…"),
  difficulty: S.enumOf(DIFFICULTIES, "Difficulté de fabrication."),
  analysis: S.obj({
    summary: S.str("Reformulation du problème en 2-3 phrases."),
    needs: S.arr(S.str(), "Besoins identifiés."),
    constraints: S.arr(S.str(), "Contraintes (taille, budget, sécurité…)."),
    assumptions: S.arr(S.str(), "Hypothèses faites quand la demande est floue."),
  }),
  solution: S.obj({
    concept: S.str("Concept de la solution en 1-2 phrases."),
    howItWorks: S.str("Fonctionnement et utilisation."),
    keyFeatures: S.arr(S.str(), "Points forts (3 à 6)."),
  }),
  dimensions: S.obj({
    width: S.num("Largeur hors-tout (X) en mm."),
    depth: S.num("Profondeur hors-tout (Z) en mm."),
    height: S.num("Hauteur hors-tout (Y) en mm."),
    weightGrams: S.num("Masse estimée en grammes."),
    notes: S.str("Remarques sur les tolérances ou l'ajustement."),
  }),
  materials: S.arr(
    S.obj({
      name: S.str(),
      usage: S.str("Pièces concernées et raison du choix."),
      quantity: S.str("Ex. : « 85 g de PLA », « 1 planche 600×200×18 »."),
      color: S.str("Couleur hexadécimale #rrggbb."),
    }),
  ),
  fabrication: S.arr(
    S.obj({
      title: S.str(),
      detail: S.str(),
      tool: S.str("Outil ou machine principale."),
      durationMin: S.int("Durée estimée en minutes."),
    }),
    "Étapes de fabrication dans l'ordre.",
  ),
  cost: S.obj({
    currency: S.str("Code devise ISO, EUR par défaut."),
    min: S.num(),
    max: S.num(),
    items: S.arr(S.obj({ label: S.str(), amount: S.num() })),
    notes: S.str(),
  }),
  recommendations: S.arr(S.str(), "Conseils d'utilisation, variantes, sécurité."),
  criteres_materiaux: S.obj(
    {
      usage: S.str("Intérieur, extérieur, humide, UV…"),
      charge: S.str("Efforts et poids supportés."),
      chaleur: S.str("Températures rencontrées."),
      contact_alimentaire: { type: "boolean" },
      budget: S.str("Niveau de budget déduit de la demande."),
      fabrication: S.str("Impression 3D, bois, métal… selon la demande et les moyens supposés."),
    },
    "Critères déduits de la demande pour choisir les matières.",
  ),
  materiaux_conseilles: S.arr(
    S.obj({
      nom: S.str("Ex. : PLA, PETG, ABS, ASA, TPU, nylon, contreplaqué, chêne, aluminium, acier inoxydable…"),
      pourquoi: S.str("Pourquoi elle convient à CETTE demande."),
      limites: S.str("Limites et précautions."),
      cout_approx: S.str("Coût approximatif lisible, ex. « ≈ 4 € la pièce (85 g) »."),
      cout_indicatif: S.num("Coût estimé en euros pour fabriquer cet objet avec cette matière."),
      procede: S.str("Procédé adapté (impression FDM, découpe laser, usinage, pliage…)."),
      couleur: S.str("Couleur hexadécimale #rrggbb typique de la matière."),
      aspect: S.enumOf(MATERIALS, "Rendu 3D le plus proche."),
      alternative_economique: { type: "boolean", description: "true pour UNE seule matière : l'alternative moins chère." },
    }),
    "3 à 5 matières classées de la plus recommandée à la moins recommandée.",
  ),
  model: S.obj({
    parts: S.arr(
      S.obj({
        id: S.str("Identifiant unique en kebab-case."),
        name: S.str("Nom lisible de la pièce."),
        role: S.str("Fonction de la pièce."),
        shape: S.enumOf(SHAPES),
        size: xyz(
          "Dimensions en mm. box : x=largeur, y=hauteur, z=profondeur. cylinder/cone/capsule : x=diamètre, y=hauteur. " +
            "tube : x=diamètre extérieur, y=hauteur, z=épaisseur de paroi. sphere : x=diamètre. " +
            "torus (anneau couché à plat) : x=diamètre extérieur, y=épaisseur du boudin. extrusion : z=épaisseur d'extrusion (x et y ignorés).",
        ),
        position: xyz("Centre de la pièce en mm (Y vers le haut, sol à y=0)."),
        rotation: xyz("Rotation en degrés (ordre XYZ)."),
        cornerRadius: S.num("Rayon des arêtes en mm pour box (0 = vif)."),
        profile: S.arr(xy, "extrusion uniquement : polygone fermé dans le plan XY en mm, centré sur 0. Sinon []."),
        holes: S.arr(S.arr(xy), "extrusion uniquement : trous (polygones) dans le profil. Sinon []."),
        color: S.str("Couleur hexadécimale #rrggbb."),
        material: S.enumOf(MATERIALS),
      }),
    ),
  }),
});
