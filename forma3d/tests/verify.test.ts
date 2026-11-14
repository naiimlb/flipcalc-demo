import { describe, expect, it } from "vitest";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import type { Design } from "@/lib/design/schema";
import { requestedMeasures, verifyDesign } from "@/lib/fabrication/verify";

describe("vérifications automatiques", () => {
  it("les exemples passent les contrôles bloquants", () => {
    for (const s of SAMPLE_DESIGNS) {
      // Grand volume : le vide-poche mural (≈ 300 mm) ne tient pas dans une imprimante de 220 mm, ce qui est exact.
      const r = verifyDesign(s.design, { request: s.prompt, printer: { x: 400, y: 400, z: 400 } });
      expect(r.checks.filter((c) => c.status === "error").map((c) => c.id)).toEqual([]);
      expect(r.checks.find((c) => c.id === "closed")?.status).toBe("ok");
      expect(r.checks.find((c) => c.id === "floating")?.status).toBe("ok");
    }
  });

  it("repère une pièce flottante", () => {
    const d: Design = structuredClone(SAMPLE_DESIGNS[0].design);
    d.model.parts[0] = { ...d.model.parts[0], position: { ...d.model.parts[0].position, y: d.model.parts[0].position.y + 500 } };
    const r = verifyDesign(d);
    expect(r.checks.find((c) => c.id === "floating")?.status).toBe("error");
    expect(r.confidence).toBe("low");
  });

  it("lit les cotes de la demande en millimètres", () => {
    expect(requestedMeasures("un cache pour un trou de 35 mm, budget 5 €, épaisseur 1,5 cm et 2 m de câble")).toEqual([35, 15, 2000]);
    expect(requestedMeasures("pour 3 personnes, 200 g")).toEqual([]);
  });

  it("signale une cote demandée absente", () => {
    const r = verifyDesign(SAMPLE_DESIGNS[0].design, { request: "avec un trou de 37,3 mm" });
    expect(r.checks.find((c) => c.id === "requested")?.status).toBe("warning");
  });

  it("refuse une pièce trop grande pour l'imprimante", () => {
    const r = verifyDesign(SAMPLE_DESIGNS[0].design, { printer: { x: 20, y: 20, z: 20 } });
    expect(r.checks.find((c) => c.id === "printer")?.status).toBe("error");
  });
});
