import { describe, expect, it } from "vitest";
import { computeGap, countCash, formatEuro, toCents } from "@/lib/money";

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
    expect(computeGap(10250, 10000)).toMatchObject({ gap: 250, kind: "surplus", text: "Excédent de 2,50 €." });
    expect(computeGap(9800, 10000)).toMatchObject({ gap: -200, kind: "shortage", text: "Manque de 2,00 €." });
  });
});
