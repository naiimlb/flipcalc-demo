/**
 * Couleurs du système de design (documentation de /design-system et tests de contraste).
 * Les valeurs font foi dans src/app/globals.css ; un test vérifie que les deux restent identiques.
 */
export type Rgb = [number, number, number];

export interface ColorToken {
  name: string;
  role: string;
  light: Rgb;
  dark: Rgb;
}

export const COLOR_TOKENS: ColorToken[] = [
  { name: "canvas", role: "Fond de l'application", light: [245, 246, 248], dark: [17, 18, 20] },
  { name: "surface", role: "Panneaux, menus, dialogues", light: [255, 255, 255], dark: [24, 25, 28] },
  { name: "paper", role: "Champs, survol, zones secondaires", light: [240, 241, 244], dark: [32, 34, 38] },
  { name: "surface-raised", role: "Éléments en relief", light: [232, 234, 238], dark: [40, 42, 47] },
  { name: "line", role: "Filets et bordures (1 px)", light: [222, 224, 229], dark: [48, 50, 56] },
  { name: "ink", role: "Texte principal", light: [22, 24, 29], dark: [236, 237, 240] },
  { name: "ink-soft", role: "Texte secondaire", light: [66, 71, 80], dark: [186, 189, 196] },
  { name: "ink-mute", role: "Libellés, aides, unités", light: [100, 106, 116], dark: [142, 146, 155] },
  { name: "accent", role: "Sélection, focus, liens (seule couleur d'accent)", light: [29, 78, 216], dark: [96, 150, 255] },
  { name: "accent-strong", role: "Fond du bouton principal (texte blanc)", light: [29, 78, 216], dark: [37, 99, 235] },
  { name: "success", role: "Validé, conforme", light: [17, 115, 52], dark: [74, 196, 112] },
  { name: "warning", role: "Avertissement", light: [163, 72, 6], dark: [230, 160, 60] },
  { name: "danger", role: "Erreur, suppression", light: [185, 28, 28], dark: [248, 96, 96] },
];

/** Couleurs des axes, réservées à la 3D. */
export const AXIS_COLORS: { axis: "X" | "Y" | "Z"; rgb: Rgb }[] = [
  { axis: "X", rgb: [230, 57, 70] },
  { axis: "Y", rgb: [46, 160, 67] },
  { axis: "Z", rgb: [47, 111, 235] },
];

export const token = (name: string) => COLOR_TOKENS.find((c) => c.name === name)!;

/** Luminance relative (WCAG 2.1). */
export function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur `fg` posée à l'opacité `alpha` sur `bg` (fonds teintés : bg-accent/15, bg-danger/10…). */
export function tint(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(bg[i] * (1 - alpha) + fg[i] * alpha)) as Rgb;
}

export const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Échelle typographique (px) et durées d'animation (ms). */
export const TYPE_SCALE = [
  { cls: "text-xs", px: 12, use: "Libellés, aides, info-bulles" },
  { cls: "text-sm", px: 13, use: "Interface dense : boutons, listes, champs" },
  { cls: "text-base", px: 14, use: "Texte courant" },
  { cls: "text-lg", px: 16, use: "Intertitres" },
  { cls: "text-xl", px: 20, use: "Titres de section" },
  { cls: "text-3xl", px: 28, use: "Titres de page" },
] as const;

export const MOTION = { fast: 120, base: 160, slow: 200 } as const;
