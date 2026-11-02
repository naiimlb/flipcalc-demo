import { describe, expect, it } from "vitest";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { exportUsdz } from "@/lib/three/export";

describe("réalité augmentée (AR Quick Look)", () => {
  it("produit un fichier USDZ (archive zip) pour iPhone et iPad", async () => {
    const usdz = await exportUsdz(SAMPLE_DESIGNS[0].design);
    expect(usdz.byteLength).toBeGreaterThan(1000);
    expect(String.fromCharCode(usdz[0], usdz[1])).toBe("PK"); // en-tête zip
    const text = new TextDecoder().decode(usdz);
    expect(text).toContain("metersPerUnit");
  });
});
