import { describe, expect, it } from "vitest";
import { PHONE_STAND } from "@/lib/design/samples";
import { validateDesign } from "@/lib/design/schema";
import { applyParameters } from "@/lib/design/parameters";
import { verifyDesign } from "@/lib/fabrication/verify";

describe("paramètres nommés", () => {
  it("le support de téléphone propose 3 réglages valides", () => {
    const v = validateDesign(PHONE_STAND);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.design.parametres.map((p) => p.nom)).toEqual(["Épaisseur de la semelle", "Largeur entre les flasques", "Hauteur de la lèvre avant"]);
  });

  it("aucun réglage, à ses bornes, ne laisse de pièce flottante", () => {
    for (const p of PHONE_STAND.parametres) {
      for (const value of [p.min, p.max]) {
        const out = applyParameters(PHONE_STAND, { [p.id]: value });
        expect(verifyDesign(out).checks.find((c) => c.id === "floating")?.status, `${p.nom} = ${value}`).toBe("ok");
      }
    }
  });

  it("élargir l'écart des flasques élargit l'objet de la même valeur, sans pièce flottante", () => {
    const wider = applyParameters(PHONE_STAND, { "ecart-flasques": 88 });
    expect(wider.dimensions.width).toBeCloseTo(PHONE_STAND.dimensions.width + 20, 0);
    expect(wider.model.parts.find((p) => p.id === "flasque-2")?.position.x).toBe(44);
    const report = verifyDesign(wider);
    expect(report.checks.find((c) => c.id === "floating")?.status).toBe("ok");
  });

  it("épaissir la semelle remonte les pièces posées dessus", () => {
    const thick = applyParameters(PHONE_STAND, { "epaisseur-semelle": 12 });
    const semelle = thick.model.parts.find((p) => p.id === "semelle")!;
    expect(semelle.size.y).toBe(12);
    expect(semelle.position.y).toBe(9);
    expect(thick.model.parts.find((p) => p.id === "traverse")?.position.y).toBe(20);
    expect(verifyDesign(thick).checks.find((c) => c.id === "floating")?.status).toBe("ok");
  });

  it("borne les valeurs et ne touche pas à l'original", () => {
    const out = applyParameters(PHONE_STAND, { "hauteur-levre": 999 });
    expect(out.model.parts.find((p) => p.id === "levre-1")?.size.y).toBe(25);
    expect(PHONE_STAND.model.parts.find((p) => p.id === "levre-1")?.size.y).toBe(15);
    expect(applyParameters(PHONE_STAND, {})).toBe(PHONE_STAND);
  });

  it("retire les effets vers des pièces inconnues et les bornes inversées", () => {
    const raw = structuredClone(PHONE_STAND) as unknown as { parametres: unknown[] };
    raw.parametres = [
      { id: "a", nom: "Fantôme", valeur: 5, min: 1, max: 9, effets: [{ piece: "inconnue", champ: "size.x", facteur: 1 }] },
      { id: "b", nom: "Inversé", valeur: 5, min: 9, max: 1, effets: [{ piece: "semelle", champ: "size.x", facteur: 1 }] },
    ];
    const v = validateDesign(raw);
    expect(v.ok && v.design.parametres.map((p) => [p.id, p.min, p.max])).toEqual([["b", 1, 9]]);
  });
});
