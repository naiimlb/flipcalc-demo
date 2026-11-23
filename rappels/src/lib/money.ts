// Tous les calculs d'argent se font ici, en CENTIMES (entiers), jamais en flottants.
// Ce module est la seule source de vérité : l'écran de comptage ET les outils de l'assistant l'utilisent.

export type Cents = number;

/** Billets et pièces euro, en centimes, du plus grand au plus petit. */
export const DENOMINATIONS: readonly Cents[] = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

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
  if (gap === 0) return { gap, kind: "exact", text: "Aucun écart : la caisse est juste." };
  if (gap > 0) return { gap, kind: "surplus", text: `Excédent de ${formatEuro(gap)}.` };
  return { gap, kind: "shortage", text: `Manque de ${formatEuro(-gap)}.` };
}

/** TVA à partir d'un montant HT ou TTC. `ratePercent` : 10, 5.5, 20… */
export function vat(amount: Cents, from: "HT" | "TTC", ratePercent: number) {
  const bp = Math.round(ratePercent * 100); // points de base : 10 % = 1000
  if (from === "HT") {
    const tva = Math.round((amount * bp) / 10000);
    return { ht: amount, tva, ttc: amount + tva };
  }
  const ht = Math.round((amount * 10000) / (10000 + bp));
  return { ht, tva: amount - ht, ttc: amount };
}

/** Rendu de monnaie : montant dû, montant donné par le client. */
export function change(due: Cents, given: Cents) {
  const diff = given - due;
  if (diff < 0) return { ok: false as const, missing: -diff, back: 0, parts: [] as CountLine[] };
  let rest = diff;
  const parts: CountLine[] = [];
  for (const d of DENOMINATIONS) {
    if (d >= 50000) continue; // on ne rend pas de 500 €
    const q = Math.floor(rest / d);
    if (q > 0) {
      parts.push({ denomination: d, quantity: q, subtotal: d * q, label: `${q} × ${formatDenomination(d)}` });
      rest -= d * q;
    }
  }
  return { ok: true as const, missing: 0, back: diff, parts };
}

/** Pourcentage d'un montant, ajout, retrait, ou « quel % représente X de Y ». */
export function percent(op: "part" | "ajouter" | "retirer", amount: Cents, pct: number): Cents {
  const part = Math.round((amount * Math.round(pct * 100)) / 10000);
  return op === "part" ? part : op === "ajouter" ? amount + part : amount - part;
}

export function percentOf(part: Cents, total: Cents): number | null {
  if (total === 0) return null;
  return Math.round((part / total) * 10000) / 100; // 2 décimales
}

/** Partage équitable : les centimes restants vont aux premières parts. */
export function split(amount: Cents, parts: number): Cents[] {
  const base = Math.floor(amount / parts);
  const extra = amount - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}
