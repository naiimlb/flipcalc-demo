import { describe, expect, it } from "vitest";
import { change, computeGap, countCash, formatEuro, percent, percentOf, split, toCents, vat } from "@/lib/money";

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

  it("calcule la TVA à 10 %", () => {
    expect(vat(1100, "TTC", 10)).toEqual({ ht: 1000, tva: 100, ttc: 1100 });
    expect(vat(1000, "HT", 10)).toEqual({ ht: 1000, tva: 100, ttc: 1100 });
    const r = vat(999, "TTC", 10); // arrondi : HT 908 + TVA 91
    expect(r.ht + r.tva).toBe(999);
    expect(vat(1000, "HT", 5.5).tva).toBe(55);
  });

  it("rend la monnaie", () => {
    const r = change(1270, 2000);
    expect(r.ok && r.back).toBe(730);
    expect(r.parts.map((p) => p.label)).toEqual(["1 × 5 €", "1 × 2 €", "1 × 0,20 €", "1 × 0,10 €"]);
    const short = change(2000, 1500);
    expect(short).toMatchObject({ ok: false, missing: 500 });
  });

  it("calcule les pourcentages", () => {
    expect(percent("part", 2000, 15)).toBe(300);
    expect(percent("ajouter", 2000, 10)).toBe(2200);
    expect(percent("retirer", 2000, 10)).toBe(1800);
    expect(percentOf(250, 1000)).toBe(25);
    expect(percentOf(1, 3)).toBe(33.33);
    expect(percentOf(5, 0)).toBeNull();
  });

  it("partage un montant sans perdre de centime", () => {
    expect(split(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(split(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
  });
});
