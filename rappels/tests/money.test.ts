import { describe, expect, it } from "vitest";
import { cashTotals, computeGap, countCash, formatEuro, plural, toCents } from "@/lib/money";

describe("money (centimes)", () => {
  it("convertit les saisies sans erreur de flottant", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("12,50")).toBe(1250);
    expect(toCents("12.5 €")).toBe(1250);
    expect(toCents("abc")).toBeNull();
    expect(toCents(Infinity)).toBeNull();
    expect(toCents(1e12)).toBeNull();
  });

  it("formate en euros", () => {
    expect(formatEuro(15250)).toBe("152,50 €");
    expect(formatEuro(5)).toBe("0,05 €");
  });

  it("compte la caisse ligne par ligne", () => {
    const r = countCash([
      { denomination: 2000, quantity: 3 },
      { denomination: 500, quantity: 4 },
      { denomination: 50, quantity: 7 },
      { denomination: 100, quantity: 0 },
    ]);
    expect(r.total).toBe(6000 + 2000 + 350);
    expect(r.pieces).toBe(14);
    expect(r.rows.map((x) => x.label)).toEqual(["3 × 20 € = 60,00 €", "4 × 5 € = 20,00 €", "7 × 0,50 € = 3,50 €"]);
  });

  it("calcule l'écart", () => {
    expect(computeGap(10000, 10000).kind).toBe("exact");
    expect(computeGap(10250, 10000)).toMatchObject({ gap: 250, kind: "surplus", text: "Surplus de 2,50 €." });
    expect(computeGap(9800, 10000)).toMatchObject({ gap: -200, kind: "shortage", text: "Manque de 2,00 €." });
  });
});

describe("détail billets / pièces", () => {
  it("sépare billets et pièces avec montants et nombres", () => {
    const t = cashTotals([
      { denomination: 2000, quantity: 4 }, // 4 × 20 €
      { denomination: 500, quantity: 2 }, // 2 × 5 €
      { denomination: 200, quantity: 3 }, // 3 × 2 € (pièces)
      { denomination: 50, quantity: 5 }, // 5 × 0,50 €
      { denomination: 1, quantity: 7 }, // 7 × 0,01 €
    ]);
    expect(t.bills).toEqual({ total: 9000, count: 6 });
    expect(t.coins).toEqual({ total: 600 + 250 + 7, count: 15 });
    expect(t.total).toBe(9000 + 857);
  });

  it("aucun arrondi : 0,01 € × 3 + 0,02 € × 2 + 0,05 € = 0,12 €", () => {
    expect(cashTotals([{ denomination: 1, quantity: 3 }, { denomination: 2, quantity: 2 }, { denomination: 5, quantity: 1 }]).total).toBe(12);
  });

  it("le fond de caisse se déduit : recette = total − fond ; l'écart se compare à la recette", () => {
    const total = cashTotals([{ denomination: 10000, quantity: 3 }, { denomination: 2000, quantity: 4 }]).total; // 380,00 €
    const recette = total - 15000; // fond de 150 €
    expect(recette).toBe(23000);
    expect(computeGap(recette, 23000).text).toBe("OK : aucun écart.");
    expect(computeGap(recette, 23250).text).toBe("Manque de 2,50 €.");
    expect(computeGap(recette, 22800).text).toBe("Surplus de 2,00 €.");
  });

  it("format français et pluriels", () => {
    expect(formatEuro(123450)).toBe("1 234,50 €");
    expect(plural(1, "billet")).toBe("1 billet");
    expect(plural(6, "billet")).toBe("6 billets");
    expect(plural(0, "pièce")).toBe("0 pièce");
  });
});
