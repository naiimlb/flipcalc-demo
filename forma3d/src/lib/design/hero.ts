import { DESK_ORGANIZER, PHONE_STAND } from "./samples";
import type { MaterialKind, Part, Shape } from "./schema";

/**
 * Objets du héros de la page d'accueil : de vraies pièces Forma3D (support, boîte, figurine, pièce mécanique),
 * décrites avec les mêmes formes que les conceptions, donc légères (aucun fichier à télécharger)
 * et jamais générées en direct.
 */
export interface HeroObject {
  id: "support" | "boite" | "figurine" | "piece";
  parts: Part[];
}

type V = [number, number, number];

function p(id: string, shape: Shape, size: V, position: V, color: string, material: MaterialKind = "plastic", extra: Partial<Part> = {}): Part {
  return {
    id,
    name: id,
    role: "",
    shape,
    size: { x: size[0], y: size[1], z: size[2] },
    position: { x: position[0], y: position[1], z: position[2] },
    rotation: { x: 0, y: 0, z: 0 },
    cornerRadius: 0,
    profile: [],
    holes: [],
    color,
    material,
    ...extra,
  };
}

/** Recolore une conception d'exemple aux couleurs de l'identité (en gardant ses matières). */
function tint(parts: Part[], colors: string[]): Part[] {
  return parts.map((part, i) => ({ ...part, color: colors[i % colors.length] }));
}

function circle(r: number, n: number, cx = 0, cy = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

/** Roue dentée de 12 dents, alésage central et 4 allègements. */
function gear(): Part[] {
  const teeth = 12;
  const outer = 40;
  const inner = 33;
  const profile: { x: number; y: number }[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    for (const [f, r] of [
      [0, inner],
      [0.18, outer],
      [0.5, outer],
      [0.68, inner],
    ] as const) {
      const a = a0 + f * step;
      profile.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }
  const holes = [circle(8, 24), ...[0, 1, 2, 3].map((k) => circle(6, 18, Math.cos((k * Math.PI) / 2 + Math.PI / 4) * 20, Math.sin((k * Math.PI) / 2 + Math.PI / 4) * 20))];
  return [
    p("roue", "extrusion", [80, 80, 12], [0, 0, 0], "#c9cfdc", "metal", { profile, holes }),
    p("moyeu", "tube", [24, 20, 5], [0, 0, 0], "#8e97ab", "metal", { rotation: { x: 90, y: 0, z: 0 } }),
  ];
}

/** Petite figurine stylisée sur socle. */
function figurine(): Part[] {
  const coral = "#ff6b4a";
  const skin = "#f4efe9";
  const dark = "#14151c";
  return [
    p("socle", "cylinder", [56, 7, 56], [0, 3.5, 0], dark),
    p("jambe-g", "capsule", [12, 28, 12], [-7, 20, 0], "#2f6bff"),
    p("jambe-d", "capsule", [12, 28, 12], [7, 20, 0], "#2f6bff"),
    p("corps", "capsule", [30, 40, 30], [0, 46, 0], coral),
    p("bras-g", "capsule", [9, 28, 9], [-19, 48, 0], coral, "plastic", { rotation: { x: 0, y: 0, z: -18 } }),
    p("bras-d", "capsule", [9, 28, 9], [19, 48, 0], coral, "plastic", { rotation: { x: 0, y: 0, z: 18 } }),
    p("tete", "sphere", [32, 32, 32], [0, 80, 0], skin),
    p("oeil-g", "sphere", [5, 5, 5], [-6, 82, 14], dark),
    p("oeil-d", "sphere", [5, 5, 5], [6, 82, 14], dark),
    p("antenne", "cylinder", [2.5, 12, 2.5], [0, 100, 0], dark),
    p("bout", "sphere", [7, 7, 7], [0, 107, 0], "#8b5cf6"),
  ];
}

export const HERO_OBJECTS: HeroObject[] = [
  { id: "support", parts: tint(PHONE_STAND.model.parts, ["#2f6bff", "#2f6bff", "#e8ebf5", "#e8ebf5", "#14151c", "#14151c"]) },
  { id: "boite", parts: tint(DESK_ORGANIZER.model.parts, ["#eceef6", "#ff6b4a", "#eceef6", "#8b5cf6", "#eceef6"]) },
  { id: "figurine", parts: figurine() },
  { id: "piece", parts: gear() },
];
