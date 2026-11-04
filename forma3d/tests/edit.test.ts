import { describe, expect, it } from "vitest";
import { EditHistory, deletePart, duplicatePart, renameDesign, updatePart } from "@/lib/design/edit";
import { PHONE_STAND } from "@/lib/design/samples";
import { validateDesign } from "@/lib/design/schema";

const base = PHONE_STAND;
const first = base.model.parts[0];

describe("modifications de l'éditeur", () => {
  it("met à jour une pièce sans toucher à l'original et borne les valeurs", () => {
    const next = updatePart(base, first.id, { position: { x: 99999, y: 10, z: -3 }, size: { x: 0, y: 20, z: 30 }, color: "#FF0000", name: "  Flasque  " });
    expect(next).not.toBe(base);
    expect(base.model.parts[0].position).toEqual(first.position);
    const part = next.model.parts[0];
    expect(part.position.x).toBe(5000);
    expect(part.size.x).toBe(0.5);
    expect(part.color).toBe("#ff0000");
    expect(part.name).toBe("Flasque");
    expect(validateDesign(next).ok).toBe(true);
  });

  it("ignore une couleur ou une matière invalide", () => {
    const next = updatePart(base, first.id, { color: "rouge", material: "or" as never });
    expect(next.model.parts[0].color).toBe(first.color);
    expect(next.model.parts[0].material).toBe(first.material);
  });

  it("duplique une pièce avec un identifiant unique, juste après l'originale", () => {
    const a = duplicatePart(base, first.id);
    const b = duplicatePart(a.design, first.id);
    expect(a.id).not.toBeNull();
    expect(b.id).not.toBe(a.id);
    expect(b.design.model.parts).toHaveLength(base.model.parts.length + 2);
    expect(a.design.model.parts[1].id).toBe(a.id);
    expect(new Set(b.design.model.parts.map((p) => p.id)).size).toBe(b.design.model.parts.length);
  });

  it("supprime une pièce mais jamais la dernière", () => {
    const next = deletePart(base, first.id);
    expect(next.model.parts).toHaveLength(base.model.parts.length - 1);
    let single = base;
    for (const p of base.model.parts.slice(1)) single = deletePart(single, p.id);
    expect(single.model.parts).toHaveLength(1);
    expect(deletePart(single, single.model.parts[0].id)).toBe(single);
  });

  it("renomme le projet", () => {
    expect(renameDesign(base, "  Mon support ").title).toBe("Mon support");
    expect(renameDesign(base, "   ")).toBe(base);
  });
});

describe("historique annuler / rétablir", () => {
  it("annule et rétablit dans l'ordre, et regroupe les frappes d'un même champ", () => {
    const h = new EditHistory();
    const v1 = renameDesign(base, "A");
    h.record(base, null, 0);
    const v2 = renameDesign(v1, "B");
    h.record(v1, "titre", 1000);
    const v3 = renameDesign(v2, "BC");
    h.record(v2, "titre", 1300); // regroupé avec la frappe précédente
    expect(h.size).toBe(2);
    expect(h.undo(v3)).toBe(v1);
    expect(h.undo(v1)).toBe(base);
    expect(h.canUndo).toBe(false);
    expect(h.redo(base)).toBe(v1);
    expect(h.redo(v1)).toBe(v3);
    expect(h.canRedo).toBe(false);
  });

  it("une nouvelle modification efface ce qui pouvait être rétabli", () => {
    const h = new EditHistory();
    const v1 = renameDesign(base, "A");
    h.record(base);
    h.undo(v1);
    expect(h.canRedo).toBe(true);
    h.record(base);
    expect(h.canRedo).toBe(false);
  });
});
