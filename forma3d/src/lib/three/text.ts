import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import type { GlyphShape } from "../design/ops";

/**
 * Polices vectorielles fournies avec Three.js (caractères latins), chargées à la demande
 * uniquement quand on ajoute un texte (aucun poids au premier affichage).
 */
export const TEXT_FONTS = {
  "helvetiker-bold": { label: "Helvetiker (gras)", load: () => import("three/examples/fonts/helvetiker_bold.typeface.json") },
  "helvetiker-regular": { label: "Helvetiker", load: () => import("three/examples/fonts/helvetiker_regular.typeface.json") },
  "optimer-bold": { label: "Optimer (gras)", load: () => import("three/examples/fonts/optimer_bold.typeface.json") },
  "gentilis-bold": { label: "Gentilis (empattements)", load: () => import("three/examples/fonts/gentilis_bold.typeface.json") },
} as const;
export type TextFontId = keyof typeof TEXT_FONTS;

const cache = new Map<TextFontId, Font>();

export async function loadTextFont(id: TextFontId): Promise<Font> {
  const hit = cache.get(id);
  if (hit) return hit;
  const mod = (await TEXT_FONTS[id].load()) as { default?: unknown };
  const font = new FontLoader().parse((mod.default ?? mod) as never);
  cache.set(id, font);
  return font;
}

/** Contours des lettres d'un texte, en millimètres (hauteur des capitales ≈ `size`). */
export function textGlyphs(font: Font, text: string, size: number): GlyphShape[] {
  const shapes = font.generateShapes(text.slice(0, 40), size);
  const points = (pts: { x: number; y: number }[]) => {
    const out = pts.map((p) => ({ x: p.x, y: p.y }));
    const first = out[0];
    const last = out[out.length - 1];
    if (first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) out.pop();
    return out;
  };
  return shapes.map((shape) => ({
    outer: points(shape.getPoints(6)),
    holes: shape.holes.map((h) => points(h.getPoints(6))),
  }));
}
