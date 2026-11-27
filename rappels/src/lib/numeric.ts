// Saisie de nombres au clavier numérique : nettoyage des caractères, bornes, et calcul du défilement.

/** Quantité maximale d'une coupure (4 chiffres). */
export const MAX_QTY = 9999;

/** Garde uniquement les chiffres, sans zéros devant, tronqué à `maxDigits`. "007" → "7", "a1b2" → "12", "" → "". */
export function cleanDigits(raw: string, maxDigits = String(MAX_QTY).length): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
}

/** Quantité saisie : un champ vide ou sans chiffre vaut 0, jamais plus de `max`. */
export function parseQuantity(raw: string, max = MAX_QTY): number {
  const digits = cleanDigits(raw, String(max).length);
  return digits ? Math.min(max, Number(digits)) : 0;
}

/** Texte affiché dans un champ de quantité : vide pour 0 (le « 0 » gris est le placeholder). */
export const quantityText = (n: number): string => (n > 0 ? String(n) : "");

/**
 * Montant en euros saisi au clavier : chiffres et UNE virgule (le point devient virgule), 2 décimales au plus,
 * pas de zéros devant ("007,5" → "7,5", "0,5" reste "0,5"), 7 chiffres entiers au plus.
 */
export function cleanAmount(raw: string): string {
  const s = raw.replace(/[^\d.,]/g, "");
  const i = s.search(/[.,]/);
  const intPart = (i === -1 ? s : s.slice(0, i)).replace(/\D/g, "");
  let int = intPart.replace(/^0+(?=\d)/, "").slice(0, 7);
  if (i === -1) return int;
  const dec = s.slice(i + 1).replace(/\D/g, "").slice(0, 2);
  if (int === "") int = "0";
  return `${int},${dec}`;
}

export type ViewBox = { top: number; bottom: number };

/**
 * De combien faire défiler la page pour que le champ soit entièrement visible dans la zone libre
 * (ni sous le clavier, ni sous la barre d'outils, ni sous le bloc de totaux). Positif = vers le bas.
 * Si le champ est plus haut que la zone, on aligne son haut.
 */
export function scrollDelta(rect: { top: number; bottom: number }, free: ViewBox, margin = 10): number {
  const top = free.top + margin;
  const bottom = free.bottom - margin;
  if (rect.bottom - rect.top > bottom - top) return rect.top - top;
  if (rect.bottom > bottom) return rect.bottom - bottom;
  if (rect.top < top) return rect.top - top;
  return 0;
}

/** Champ voisin dans une liste ordonnée : -1 précédent, +1 suivant ; null au bout de la liste. */
export function neighbour<T>(list: T[], current: T, step: 1 | -1): T | null {
  const i = list.indexOf(current);
  if (i === -1) return null;
  return list[i + step] ?? null;
}
