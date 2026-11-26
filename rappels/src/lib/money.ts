// Calculs d'argent de l'écran « Compter la caisse », en CENTIMES (entiers), jamais en flottants.

export type Cents = number;

const MAX_CENTS = 1_000_000_00; // 1 million d'euros : au-delà, c'est forcément une erreur de saisie

const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 15250 → "152,50 €" (espaces insécables normalisés en espaces simples). */
export function formatEuro(cents: Cents): string {
  return eurFmt.format(cents / 100).replace(/[  ]/g, " ");
}

/** Valeur de coupure lisible : 50000 → "500 €", 50 → "0,50 €". */
export function formatDenomination(cents: Cents): string {
  return cents % 100 === 0 ? `${cents / 100} €` : formatEuro(cents);
}

/** Convertit une saisie (12.5, "12,50", "12.50 €") en centimes. Renvoie null si invalide. */
export function toCents(input: unknown): Cents | null {
  let n: number;
  if (typeof input === "number") n = input;
  else if (typeof input === "string") n = Number(input.replace(/[€\s]/g, "").replace(",", "."));
  else return null;
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return Math.abs(cents) > MAX_CENTS ? null : cents;
}

export type CountLine = { denomination: Cents; quantity: number; subtotal: Cents; label: string };

/** Comptage de caisse : une ligne par coupure (les quantités à 0 sont ignorées). */
export function countCash(lines: { denomination: Cents; quantity: number }[]) {
  const merged = new Map<Cents, number>();
  for (const l of lines) merged.set(l.denomination, (merged.get(l.denomination) ?? 0) + l.quantity);
  const rows: CountLine[] = [...merged.entries()]
    .filter(([, q]) => q > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([denomination, quantity]) => ({
      denomination,
      quantity,
      subtotal: denomination * quantity,
      label: `${quantity} × ${formatDenomination(denomination)} = ${formatEuro(denomination * quantity)}`,
    }));
  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  const pieces = rows.reduce((s, r) => s + r.quantity, 0);
  return { rows, total, pieces };
}

export type Gap = { gap: Cents; kind: "exact" | "surplus" | "shortage"; text: string };

/** Écart = compté − attendu. Positif : excédent. Négatif : manque. */
export function computeGap(counted: Cents, expected: Cents): Gap {
  const gap = counted - expected;
  if (gap === 0) return { gap, kind: "exact", text: "OK : aucun écart." };
  if (gap > 0) return { gap, kind: "surplus", text: `Surplus de ${formatEuro(gap)}.` };
  return { gap, kind: "shortage", text: `Manque de ${formatEuro(-gap)}.` };
}

/** Billets (5 € et plus) d'un côté, pièces (2 € et moins) de l'autre, avec montants et nombres. */
export function cashTotals(lines: { denomination: Cents; quantity: number }[]) {
  const { rows } = countCash(lines);
  const sum = (list: CountLine[]) => ({ total: list.reduce((a, r) => a + r.subtotal, 0), count: list.reduce((a, r) => a + r.quantity, 0) });
  const bills = sum(rows.filter((r) => r.denomination >= 500));
  const coins = sum(rows.filter((r) => r.denomination < 500));
  return { bills, coins, total: bills.total + coins.total };
}

/** « 1 billet », « 6 billets » (0 → « 0 billet »). */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}
