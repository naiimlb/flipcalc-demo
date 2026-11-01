import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { SHAPES, type Part } from "@/lib/design/schema";
import { computeDesignBounds, computeExplodeOffsets, createPartGeometry } from "@/lib/three/geometry";
import { exportStl } from "@/lib/three/export";

function basePart(shape: Part["shape"]): Part {
  return {
    id: shape,
    name: shape,
    role: "",
    shape,
    size: { x: 40, y: 20, z: 4 },
    position: { x: 0, y: 10, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    cornerRadius: 3,
    profile: [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 0, y: 12 },
    ],
    holes: [],
    color: "#5b6ee1",
    material: "plastic",
  };
}

describe("géométries", () => {
  it.each(SHAPES)("%s : géométrie finie, aux bonnes dimensions", (shape) => {
    const geometry = createPartGeometry(basePart(shape));
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(Number.isFinite(size.x) && Number.isFinite(size.y) && Number.isFinite(size.z)).toBe(true);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
    if (shape === "box") expect([size.x, size.y, size.z].map(Math.round)).toEqual([40, 20, 4]);
    if (shape === "cylinder" || shape === "tube") expect([size.x, size.y].map(Math.round)).toEqual([40, 20]);
    if (shape === "torus") expect(Math.abs(size.x - 40)).toBeLessThan(2); // anneau couché : diamètre sur X et Z
    if (shape === "extrusion") expect(Math.round(size.z)).toBe(4);
  });

  it("les dimensions annoncées des exemples correspondent au modèle 3D (±10 %)", () => {
    for (const { id, design } of SAMPLE_DESIGNS) {
      const size = computeDesignBounds(design).getSize(new THREE.Vector3());
      const close = (actual: number, expected: number) => Math.abs(actual - expected) / expected < 0.1;
      expect(close(size.x, design.dimensions.width), `${id} largeur ${size.x}`).toBe(true);
      expect(close(size.y, design.dimensions.height), `${id} hauteur ${size.y}`).toBe(true);
      expect(close(size.z, design.dimensions.depth), `${id} profondeur ${size.z}`).toBe(true);
    }
  });

  it("les exemples reposent sur le sol (y = 0)", () => {
    for (const { id, design } of SAMPLE_DESIGNS) {
      expect(Math.abs(computeDesignBounds(design).min.y), id).toBeLessThan(0.5);
    }
  });

  it("vue éclatée : un décalage par pièce", () => {
    const { design } = SAMPLE_DESIGNS[0];
    const offsets = computeExplodeOffsets(design, computeDesignBounds(design));
    expect(offsets.size).toBe(design.model.parts.length);
    for (const v of offsets.values()) expect(v.length()).toBeGreaterThan(0);
  });
});

describe("export STL", () => {
  it("produit un STL binaire valide en millimètres", () => {
    const { design } = SAMPLE_DESIGNS[1];
    const buffer = exportStl(design);
    const view = new DataView(buffer);
    const triangles = view.getUint32(80, true);
    expect(triangles).toBeGreaterThan(100);
    expect(buffer.byteLength).toBe(84 + triangles * 50);
    // Première coordonnée dans l'enveloppe du modèle (mm, pas m).
    const x = view.getFloat32(84 + 12, true);
    expect(Math.abs(x)).toBeLessThan(200);
  });
});
