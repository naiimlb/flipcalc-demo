import { describe, expect, it } from "vitest";
import {
  addShape,
  addText,
  applyAiOps,
  arrayCircular,
  arrayLinear,
  chamferPart,
  cutInHalf,
  designBounds,
  drillHole,
  filletPart,
  freeformPart,
  groupMembers,
  groupParts,
  hollowPart,
  mirrorPart,
  scaleToSize,
  simplifyPath,
  translateParts,
  ungroupParts,
  type OpResult,
} from "@/lib/design/ops";
import { PHONE_STAND, WALL_KEY_SHELF } from "@/lib/design/samples";
import { validateDesign, type Design } from "@/lib/design/schema";

const base: Design = WALL_KEY_SHELF;
const box = base.model.parts.find((p) => p.shape === "box")!;

function ok(r: OpResult) {
  if ("error" in r) throw new Error(`opération refusée : ${r.error}`);
  const v = validateDesign(r.design);
  expect(v.ok).toBe(true);
  return r;
}

describe("ajout de formes et échelle", () => {
  it("ajoute une forme au sol, à côté du modèle", () => {
    const r = ok(addShape(base, "cylinder", "Cylindre"));
    const part = r.design.model.parts.at(-1)!;
    expect(part.shape).toBe("cylinder");
    expect(part.position.y).toBeCloseTo(20);
    expect(part.position.x).toBeGreaterThan(designBounds(base).max.x);
  });

  it("met le modèle à l'échelle réelle (plus grande dimension)", () => {
    const scaled = scaleToSize(base, 150);
    const s = designBounds(scaled).size;
    expect(Math.max(s.x, s.y, s.z)).toBeCloseTo(150, 0);
    expect(validateDesign(scaled).ok).toBe(true);
  });
});

describe("miroir et répétitions", () => {
  it("crée une copie symétrique (profil retourné pour un profilé)", () => {
    const ext = PHONE_STAND.model.parts.find((p) => p.shape === "extrusion")!;
    const r = ok(mirrorPart(PHONE_STAND, ext.id, "x"));
    const copy = r.design.model.parts.find((p) => p.id === r.ids[0])!;
    expect(copy.profile[0].x).toBeCloseTo(-ext.profile[0].x);
    expect(r.design.model.parts).toHaveLength(PHONE_STAND.model.parts.length + 1);
  });

  it("répète en ligne et en cercle", () => {
    const line = ok(arrayLinear(base, box.id, 4, 30, "x"));
    expect(line.ids).toHaveLength(3);
    const ring = ok(arrayCircular(base, box.id, 6));
    expect(ring.ids).toHaveLength(5);
    expect(new Set(ring.design.model.parts.map((p) => p.id)).size).toBe(ring.design.model.parts.length);
  });
});

describe("couper, évider, percer", () => {
  it("coupe un pavé en deux moitiés jointives", () => {
    const r = ok(cutInHalf(base, box.id, "x"));
    const [a, b] = r.ids.map((id) => r.design.model.parts.find((p) => p.id === id)!);
    expect(a.size.x).toBeCloseTo(box.size.x / 2);
    expect(Math.abs(a.position.x - b.position.x)).toBeCloseTo(box.size.x / 2, 1);
  });

  it("refuse de couper une sphère", () => {
    const withSphere = ok(addShape(base, "sphere", "Boule"));
    expect(cutInHalf(withSphere.design, withSphere.ids[0], "x")).toEqual({ error: "unsupported" });
  });

  it("évide un pavé en boîte ouverte assemblée", () => {
    const r = ok(hollowPart(base, box.id, 3));
    expect(r.ids).toHaveLength(5);
    const group = r.design.model.parts.find((p) => p.id === r.ids[0])!.group;
    expect(group).toBeTruthy();
    expect(groupMembers(r.design, r.ids[2])).toHaveLength(5);
  });

  it("perce un trou de diamètre exact dans un pavé (perçage vertical)", () => {
    const r = ok(drillHole(base, box.id, 8, 0, 0, "y"));
    const part = r.design.model.parts.find((p) => p.id === box.id)!;
    expect(part.shape).toBe("extrusion");
    expect(part.holes).toHaveLength(1);
    const xs = part.holes[0].map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(8, 1);
    expect(part.size.z).toBeCloseTo(box.size.y);
  });

  it("refuse un trou qui sort de la pièce", () => {
    expect(drillHole(base, box.id, 8, box.size.x, 0, "y")).toEqual({ error: "outside" });
  });

  it("arrondit (congé) et chanfreine un pavé", () => {
    const f = ok(filletPart(base, box.id, 2));
    expect(f.design.model.parts.find((p) => p.id === box.id)!.cornerRadius).toBe(2);
    const c = ok(chamferPart(base, box.id, 3));
    expect(c.design.model.parts.find((p) => p.id === box.id)!.profile).toHaveLength(8);
  });
});

describe("assemblage, forme libre, texte, IA", () => {
  it("assemble, déplace ensemble puis sépare", () => {
    const ids = base.model.parts.slice(0, 2).map((p) => p.id);
    const g = ok(groupParts(base, ids));
    expect(groupMembers(g.design, ids[0])).toEqual(ids);
    const moved = translateParts(g.design, ids, { x: 10, y: 0, z: 0 });
    expect(moved.model.parts[0].position.x).toBeCloseTo(base.model.parts[0].position.x + 10);
    const u = ok(ungroupParts(g.design, ids));
    expect(u.design.model.parts[0].group).toBeUndefined();
  });

  it("extrude un tracé fait au doigt (simplifié)", () => {
    const path = Array.from({ length: 400 }, (_, i) => {
      const a = (i / 400) * Math.PI * 2;
      return { x: Math.cos(a) * 30, y: Math.sin(a) * 20 };
    });
    expect(simplifyPath(path, 0.6).length).toBeLessThanOrEqual(160);
    const r = ok(freeformPart(base, path, 5, "Forme libre"));
    const part = r.design.model.parts.at(-1)!;
    expect(part.shape).toBe("extrusion");
    expect(part.size.z).toBe(5);
  });

  const square = (x: number, s: number) => ({
    outer: [{ x, y: 0 }, { x: x + s, y: 0 }, { x: x + s, y: s }, { x, y: s }],
    holes: [[{ x: x + 2, y: 2 }, { x: x + s - 2, y: 2 }, { x: x + s - 2, y: s - 2 }, { x: x + 2, y: s - 2 }]],
  });

  it("ajoute un texte en relief sur une pièce", () => {
    const r = ok(addText(base, [square(0, 10), square(12, 10)], { mode: "relief", depth: 2, supportId: box.id, name: "Texte", color: "#ffffff" }));
    expect(r.ids).toHaveLength(2);
    const letter = r.design.model.parts.find((p) => p.id === r.ids[0])!;
    expect(letter.holes).toHaveLength(1);
  });

  it("grave un texte dans un pavé (couche percée + îlots)", () => {
    const r = ok(addText(base, [square(0, 10)], { mode: "engrave", depth: 1.5, supportId: box.id, name: "Texte", color: "#ffffff" }));
    const layer = r.design.model.parts.find((p) => p.id === r.ids[0])!;
    expect(layer.holes).toHaveLength(1);
    expect(r.design.model.parts.find((p) => p.id === box.id)!.size.y).toBeCloseTo(box.size.y - 1.5);
    expect(r.design.model.parts.some((p) => p.name.includes("îlot"))).toBe(true);
  });

  it("applique les changements proposés par l'IA", () => {
    const changed = { ...box, size: { ...box.size, x: box.size.x + 10 } };
    const r = applyAiOps(base, [{ op: "replace", part: changed }, { op: "delete", id: "inconnu" }]);
    expect(r.design.model.parts.find((p) => p.id === box.id)!.size.x).toBe(box.size.x + 10);
    expect(r.ids).toEqual([box.id]);
  });
});
