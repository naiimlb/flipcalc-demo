import { describe, expect, it } from "vitest";
import { PHONE_STAND } from "@/lib/design/samples";
import { crc32, createZip } from "@/lib/files/zip";
import { export3mf } from "@/lib/three/export3mf";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("export 3MF", () => {
  it("CRC-32 conforme", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("archive ZIP lisible (signatures, noms)", () => {
    const zip = createZip([{ name: "a.txt", data: "bonjour" }]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(text(zip)).toContain("a.txt");
  });

  it("produit un 3MF posé sur le plateau, centré, en millimètres, marqué « généré par IA »", () => {
    const file = export3mf(PHONE_STAND, { printer: { x: 256, y: 256, z: 256 } });
    const content = text(file);
    for (const name of ["[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model"]) expect(content).toContain(name);
    expect(content).toContain('unit="millimeter"');
    expect(content).toContain("générée par IA");
    const coords = [...content.matchAll(/<vertex x="([-\d.]+)" y="([-\d.]+)" z="([-\d.]+)"\/>/g)].map((m) => m.slice(1, 4).map(Number));
    expect(coords.length).toBeGreaterThan(100);
    const min = [0, 1, 2].map((i) => Math.min(...coords.map((c) => c[i])));
    const max = [0, 1, 2].map((i) => Math.max(...coords.map((c) => c[i])));
    expect(min[2]).toBeCloseTo(0, 3);
    expect((min[0] + max[0]) / 2).toBeCloseTo(128, 0);
    expect((min[1] + max[1]) / 2).toBeCloseTo(128, 0);
    expect(max[2]).toBeLessThanOrEqual(256);
  });

  it("suit l'étirement des curseurs", () => {
    const base = export3mf(PHONE_STAND);
    const wide = export3mf(PHONE_STAND, { stretch: { x: 1.5, y: 1, z: 1 } });
    // L'orientation d'impression peut coucher la pièce : on compare la somme des trois encombrements.
    const span = (bytes: Uint8Array) => {
      const coords = [...text(bytes).matchAll(/<vertex x="([-\d.]+)" y="([-\d.]+)" z="([-\d.]+)"\/>/g)].map((m) => m.slice(1, 4).map(Number));
      return [0, 1, 2].reduce((n, i) => n + Math.max(...coords.map((c) => c[i])) - Math.min(...coords.map((c) => c[i])), 0);
    };
    expect(span(wide) - span(base)).toBeCloseTo(40, 0);
  });
});
