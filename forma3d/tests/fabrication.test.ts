import { describe, expect, it } from "vitest";
import type { Design, Part } from "@/lib/design/schema";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { VARIANT_IDS, applyVariantLocally, isVariantId, variantInstruction } from "@/lib/design/variants";
import { validateDesign } from "@/lib/design/schema";
import { estimatePrint, guessPrintMaterial } from "@/lib/fabrication/estimate";
import { buildPartMeshes, volumeAndArea } from "@/lib/fabrication/mesh";
import { jpegToPdf } from "@/lib/fabrication/pdf";
import { planLayout } from "@/lib/fabrication/plan-layout";
import { DEFAULT_PRINTER, checkPrintability, partThickness } from "@/lib/fabrication/printability";
import { fabricationLinks, shoppingList } from "@/lib/fabrication/sourcing";

const base = SAMPLE_DESIGNS[0].design;

function part(overrides: Partial<Part>): Part {
  return {
    id: "p",
    name: "Pièce",
    role: "",
    shape: "box",
    size: { x: 40, y: 20, z: 40 },
    position: { x: 0, y: 10, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    cornerRadius: 0,
    profile: [],
    holes: [],
    color: "#5b6ee1",
    material: "plastic",
    ...overrides,
  };
}

function designOf(parts: Part[], extra: Partial<Design> = {}): Design {
  return { ...structuredClone(base), materiaux_conseilles: [], model: { parts }, ...extra };
}

describe("géométrie de fabrication", () => {
  it("calcule le volume et la surface d'un pavé", () => {
    const [mesh] = buildPartMeshes(designOf([part({})]), undefined, "high");
    const { volume, area } = volumeAndArea(mesh.positions);
    expect(volume).toBeCloseTo(40 * 20 * 40, 0);
    expect(area).toBeCloseTo(2 * (40 * 20 + 40 * 40 + 20 * 40), 0);
  });

  it("pose l'objet sur le plateau", () => {
    const meshes = buildPartMeshes(designOf([part({ position: { x: 0, y: 50, z: 0 } })]));
    expect(meshes[0].box.min.y).toBeCloseTo(0, 5);
  });
});

describe("contrôle d'imprimabilité", () => {
  it("un pavé simple est imprimable sans support", () => {
    const report = checkPrintability(designOf([part({})]));
    expect(report.fits).toBe(true);
    expect(report.supportsNeeded).toBe(false);
    expect(report.issues.filter((i) => i.level !== "info")).toEqual([]);
    expect(report.verdict).toBe("ok");
  });

  it("signale un objet trop grand et propose une échelle", () => {
    const report = checkPrintability(designOf([part({ size: { x: 400, y: 300, z: 300 }, position: { x: 0, y: 150, z: 0 } })]), DEFAULT_PRINTER);
    expect(report.fits).toBe(false);
    const issue = report.issues.find((i) => i.code === "size")!;
    expect(issue.level).toBe("error");
    expect(report.scaleToFit).toBeLessThan(1);
    expect(issue.fix).toMatch(/échelle à \d+ %/);
  });

  it("propose de coucher un objet trop haut qui tient une fois pivoté", () => {
    const report = checkPrintability(designOf([part({ size: { x: 40, y: 300, z: 40 }, position: { x: 0, y: 150, z: 0 } })]), { x: 320, y: 320, z: 250 });
    const issue = report.issues.find((i) => i.code === "size")!;
    expect(issue.level).toBe("warning");
    expect(report.orientations.some((o) => o.fits)).toBe(true);
  });

  it("détecte les parois trop fines", () => {
    const report = checkPrintability(designOf([part({}), part({ id: "lame", name: "Lame", size: { x: 40, y: 20, z: 0.6 }, position: { x: 0, y: 30, z: 0 } })]));
    const issue = report.issues.find((i) => i.code === "thin")!;
    expect(issue.level).toBe("error");
    expect(issue.partIds).toEqual(["lame"]);
    expect(partThickness(part({ shape: "tube", size: { x: 30, y: 50, z: 1 } }))).toBe(1);
  });

  it("détecte un porte-à-faux (plateau en T) et trouve une meilleure orientation", () => {
    const t = designOf([
      part({ id: "pied", size: { x: 10, y: 40, z: 10 }, position: { x: 0, y: 20, z: 0 } }),
      part({ id: "plateau", size: { x: 80, y: 5, z: 80 }, position: { x: 0, y: 42.5, z: 0 } }),
    ]);
    const report = checkPrintability(t);
    expect(report.supportsNeeded).toBe(true);
    expect(report.issues.some((i) => i.code === "supports")).toBe(true);
    expect(report.best.overhangArea).toBeLessThan(report.overhangArea);
  });

  it("ne compte pas comme porte-à-faux une pièce posée sur une autre", () => {
    const stacked = designOf([
      part({ id: "bas", size: { x: 60, y: 10, z: 60 }, position: { x: 0, y: 5, z: 0 } }),
      part({ id: "haut", size: { x: 40, y: 10, z: 40 }, position: { x: 0, y: 15, z: 0 } }),
    ]);
    expect(checkPrintability(stacked).supportsNeeded).toBe(false);
  });

  it("analyse les exemples sans erreur", () => {
    for (const sample of SAMPLE_DESIGNS) {
      const report = checkPrintability(sample.design);
      expect(["ok", "warning", "error"]).toContain(report.verdict);
      expect(report.size.width).toBeGreaterThan(0);
    }
  });
});

describe("estimation d'impression", () => {
  it("donne une masse, une durée et un coût cohérents", () => {
    const cube = designOf([part({ size: { x: 20, y: 20, z: 20 }, position: { x: 0, y: 10, z: 0 } })], {
      dimensions: { ...base.dimensions, width: 20, depth: 20, height: 20 },
    });
    const full = estimatePrint(cube, { material: "pla", infill: 1, layerHeight: 0.2 });
    expect(full.massGrams).toBeCloseTo(8 * 1.24, 1); // 8 cm³ de PLA plein
    const light = estimatePrint(cube, { material: "pla", infill: 0.2, layerHeight: 0.2 });
    expect(light.massGrams).toBeLessThan(full.massGrams);
    expect(light.minutes).toBeGreaterThan(0);
    expect(light.cost.max).toBeGreaterThan(light.cost.min);
    const supports = estimatePrint(cube, { material: "pla", infill: 0.2, layerHeight: 0.2 }, { supportsNeeded: true });
    expect(supports.massGrams).toBeGreaterThan(light.massGrams);
  });

  it("reconnaît les matières d'impression nommées par l'IA", () => {
    expect(guessPrintMaterial("PETG noir")).toBe("petg");
    expect(guessPrintMaterial("PLA+")).toBe("pla");
    expect(guessPrintMaterial("ASA (extérieur)")).toBe("asa");
    expect(guessPrintMaterial("Chêne massif")).toBeNull();
  });
});

describe("versions (« Plus petit », « Plus solide »…)", () => {
  it("chaque version locale reste une conception valide et marquée comme version", () => {
    for (const id of VARIANT_IDS) {
      const v = applyVariantLocally(base, id);
      const validated = validateDesign(JSON.parse(JSON.stringify(v)));
      expect(validated.ok, id).toBe(true);
      expect(v.variante?.objectif).toBe(id);
      expect(v.variante?.base).toBe(base.title);
    }
  });

  it("« Plus petit » réduit les dimensions, « Moins cher » le coût, « Plus solide » épaissit", () => {
    const smaller = applyVariantLocally(base, "smaller");
    expect(smaller.dimensions.width).toBeLessThan(base.dimensions.width);
    expect(smaller.model.parts[0].size.x).toBeLessThan(base.model.parts[0].size.x);
    expect(applyVariantLocally(base, "cheaper").cost.max).toBeLessThan(base.cost.max);
    const stronger = applyVariantLocally(base, "stronger");
    const thin = (d: Design) => Math.min(...d.model.parts.map(partThickness));
    expect(thin(stronger)).toBeGreaterThanOrEqual(thin(base));
    expect(base.variante).toBeNull(); // l'original n'est pas modifié
  });

  it("la consigne envoyée à l'IA contient la conception actuelle et l'objectif", () => {
    const text = variantInstruction("cheaper", base);
    expect(text).toContain("<conception_actuelle>");
    expect(text).toContain(base.title);
    expect(text).toMatch(/moins chère/);
    expect(isVariantId("smaller")).toBe(true);
    expect(isVariantId("autre")).toBe(false);
  });
});

describe("plans cotés et PDF", () => {
  it("met les trois vues à la même échelle normalisée, sans chevauchement", () => {
    const layout = planLayout({ width: 160, depth: 60, height: 44 });
    expect(layout.scaleLabel).toMatch(/^\d+(,\d+)?:\d+(,\d+)?$/);
    expect(layout.front.w / 160).toBeCloseTo(layout.side.w / 60, 5);
    expect(layout.front.x + layout.front.w).toBeLessThan(layout.side.x);
    expect(layout.front.y + layout.front.h).toBeLessThan(layout.top.y);
    expect(layout.top.y + layout.top.h).toBeLessThan(layout.titleBlock.y);
    expect(layout.side.x + layout.side.w).toBeLessThanOrEqual(layout.sheet.w);
    const huge = planLayout({ width: 2000, depth: 800, height: 1200 });
    expect(huge.top.y + huge.top.h).toBeLessThan(huge.titleBlock.y);
  });

  it("produit un PDF valide (en-tête, objets, table xref, fin de fichier)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = new TextDecoder("latin1").decode(jpegToPdf(jpeg, 10, 10, 842, 595, "Plan côté"));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Filter /DCTDecode");
    expect(pdf).toContain("/Title (Plan cote)");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  });
});

describe("où fabriquer", () => {
  it("ne propose que des liens de recherche génériques", () => {
    const links = fabricationLinks(base, "PETG");
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const l of links) expect(l.url).toMatch(/^https:\/\/www\.google\.com\/(search\?q=|maps\/search\/)/);
  });

  it("liste les achats avec des prix marqués comme estimés", () => {
    const estimate = estimatePrint(base, { material: "petg", infill: 0.2, layerHeight: 0.2 });
    const list = shoppingList(base, estimate);
    expect(list[0].item).toContain("PETG");
    for (const item of list) {
      expect(item.url).toMatch(/^https:\/\/www\.google\.com\/search\?q=/);
      if (item.estimate) expect(item.estimate.startsWith("≈")).toBe(true);
    }
  });
});
