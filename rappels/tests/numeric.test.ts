import { describe, expect, it } from "vitest";
import { cleanAmount, cleanDigits, MAX_QTY, neighbour, parseQuantity, quantityText, scrollDelta } from "@/lib/numeric";
import { toCents } from "@/lib/money";

describe("quantités au clavier numérique", () => {
  it("ne garde que les chiffres", () => {
    expect(cleanDigits("a1b2")).toBe("12");
    expect(cleanDigits("1,5")).toBe("15");
    expect(cleanDigits("-3")).toBe("3");
    expect(cleanDigits("+4.0e1")).toBe("401");
    expect(parseQuantity("abc")).toBe(0);
  });
  it("supprime les zéros devant : 007 devient 7", () => {
    expect(parseQuantity("007")).toBe(7);
    expect(parseQuantity("0")).toBe(0);
    expect(parseQuantity("000")).toBe(0);
    expect(cleanDigits("0012")).toBe("12");
  });
  it("champ vide = 0, et jamais plus de 9999", () => {
    expect(parseQuantity("")).toBe(0);
    expect(parseQuantity("12")).toBe(12);
    expect(parseQuantity("9999")).toBe(9999);
    expect(parseQuantity("12345")).toBe(1234); // le 5e chiffre est ignoré
    expect(parseQuantity("99999999")).toBeLessThanOrEqual(MAX_QTY);
  });
  it("affiche vide pour 0 (le placeholder montre « 0 »), sinon le nombre", () => {
    expect(quantityText(0)).toBe("");
    expect(quantityText(12)).toBe("12");
  });
});

describe("montants au clavier (fond de caisse, montant attendu)", () => {
  it("chiffres et une seule virgule, point converti, 2 décimales", () => {
    expect(cleanAmount("250,50")).toBe("250,50");
    expect(cleanAmount("250.5")).toBe("250,5");
    expect(cleanAmount("1,2,3")).toBe("1,23");
    expect(cleanAmount("12,345")).toBe("12,34");
    expect(cleanAmount("abc")).toBe("");
    expect(cleanAmount("-12")).toBe("12");
    expect(cleanAmount("12€")).toBe("12");
  });
  it("zéros devant et virgule seule", () => {
    expect(cleanAmount("007,5")).toBe("7,5");
    expect(cleanAmount("0,5")).toBe("0,5");
    expect(cleanAmount(",5")).toBe("0,5");
    expect(cleanAmount("00")).toBe("0");
    expect(cleanAmount("12345678")).toBe("1234567");
  });
  it("reste lisible par le calcul en centimes", () => {
    expect(toCents(cleanAmount("250.50"))).toBe(25050);
    expect(toCents(cleanAmount("7,"))).toBe(700);
    expect(toCents(cleanAmount("0,5"))).toBe(50);
  });
});

describe("défilement : le champ actif n'est jamais caché", () => {
  const free = { top: 0, bottom: 400 }; // zone libre au-dessus du clavier, de la barre et des totaux
  it("déjà visible : rien à faire", () => {
    expect(scrollDelta({ top: 100, bottom: 144 }, free)).toBe(0);
  });
  it("caché sous le clavier / les totaux : défile vers le bas juste assez", () => {
    expect(scrollDelta({ top: 380, bottom: 424 }, free)).toBe(34); // 424 - (400 - 10)
  });
  it("caché au-dessus : défile vers le haut", () => {
    expect(scrollDelta({ top: -30, bottom: 14 }, free)).toBe(-40);
  });
  it("zone libre minuscule : on aligne le haut du champ", () => {
    expect(scrollDelta({ top: 50, bottom: 94 }, { top: 0, bottom: 40 })).toBe(40);
  });
});

describe("passer d'une case à la suivante", () => {
  it("suivant / précédent, et null aux extrémités (la dernière ligne ferme le clavier)", () => {
    const l = ["a", "b", "c"];
    expect(neighbour(l, "a", 1)).toBe("b");
    expect(neighbour(l, "b", -1)).toBe("a");
    expect(neighbour(l, "c", 1)).toBeNull();
    expect(neighbour(l, "a", -1)).toBeNull();
    expect(neighbour(l, "z", 1)).toBeNull();
  });
});
