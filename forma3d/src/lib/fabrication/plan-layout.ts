/**
 * Mise en page d'un plan coté sur une feuille A4 paysage (calculs purs, testables) :
 * vue de face (en haut à gauche), vue de droite (en haut à droite), vue de dessus (en bas à gauche),
 * nomenclature (en bas à droite) et cartouche. Échelle normalisée (1:1, 1:2, 1:5…).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanLayout {
  sheet: { w: number; h: number };
  /** Pixels par millimètre réel. */
  pxPerMm: number;
  /** Échelle du dessin sur papier, ex. « 1:2 ». */
  scaleLabel: string;
  front: Rect;
  side: Rect;
  top: Rect;
  info: Rect;
  titleBlock: Rect;
}

/** A4 paysage à 200 points par pouce. */
export const SHEET = { w: 2339, h: 1654 };
const DPI = 200;
const PX_PER_PAPER_MM = DPI / 25.4;
const MARGIN = 70;
const DIM_SPACE = 90; // place des lignes de cote autour de chaque vue
const GAP = 60;
const TITLE_H = 170;

/** Échelles normalisées, de la plus grande à la plus petite. */
const SCALES: [number, string][] = [
  [5, "5:1"], [2, "2:1"], [1, "1:1"], [1 / 2, "1:2"], [1 / 2.5, "1:2,5"], [1 / 5, "1:5"],
  [1 / 10, "1:10"], [1 / 20, "1:20"], [1 / 50, "1:50"], [1 / 100, "1:100"],
];

export function planLayout(size: { width: number; depth: number; height: number }, sheet = SHEET): PlanLayout {
  const W = Math.max(size.width, 1);
  const D = Math.max(size.depth, 1);
  const H = Math.max(size.height, 1);
  const availW = sheet.w - 2 * MARGIN - 2 * DIM_SPACE - GAP;
  const availH = sheet.h - 2 * MARGIN - TITLE_H - 2 * DIM_SPACE - GAP;
  const maxPx = Math.min(availW / (W + D), availH / (H + D));
  const [ratio, label] = SCALES.find(([r]) => r * PX_PER_PAPER_MM <= maxPx) ?? SCALES[SCALES.length - 1];
  const s = Math.min(ratio * PX_PER_PAPER_MM, maxPx);

  const left = MARGIN + DIM_SPACE;
  const topY = MARGIN + DIM_SPACE / 2;
  const front: Rect = { x: left, y: topY, w: W * s, h: H * s };
  const side: Rect = { x: front.x + front.w + GAP + DIM_SPACE, y: topY, w: D * s, h: H * s };
  const top: Rect = { x: left, y: front.y + front.h + GAP + DIM_SPACE, w: W * s, h: D * s };
  const info: Rect = {
    x: side.x,
    y: top.y,
    w: Math.max(sheet.w - MARGIN - side.x, 200),
    h: Math.max(sheet.h - MARGIN - TITLE_H - 20 - top.y, 120),
  };
  const titleBlock: Rect = { x: MARGIN, y: sheet.h - MARGIN - TITLE_H, w: sheet.w - 2 * MARGIN, h: TITLE_H };
  return { sheet, pxPerMm: s, scaleLabel: label, front, side, top, info, titleBlock };
}
