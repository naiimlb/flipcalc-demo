import { describe, expect, it } from "vitest";
import { standardPartsHint, standardRequirements } from "@/lib/design/standard-parts";

describe("pièces normalisées", () => {
  it("reconnaît vis, écrous, inserts, aimants et roulements", () => {
    const req = standardRequirements("Un boîtier fermé par 4 vis M3 avec inserts M3, un aimant 10x3 et un roulement 608");
    expect(req.map((r) => r.label)).toEqual(["vis M3", "insert M3", "aimant 10 × 3 mm", "roulement 608"]);
    expect(req.find((r) => r.label === "roulement 608")?.acceptable).toContain(22.1);
    expect(req.find((r) => r.label.startsWith("aimant"))?.acceptable).toContain(10.2);
  });

  it("ne voit rien dans une demande ordinaire et n'ajoute aucune consigne", () => {
    expect(standardRequirements("un support de téléphone pour le bureau")).toEqual([]);
    expect(standardPartsHint("un support de téléphone pour le bureau")).toBe("");
  });

  it("donne les cotes exactes à l'IA quand une pièce normalisée est citée", () => {
    const hint = standardPartsHint("une équerre fixée par des vis M4");
    expect(hint).toContain("M4 : trou de passage Ø 4.5 mm");
    expect(hint).not.toContain("M3 :");
  });
});
