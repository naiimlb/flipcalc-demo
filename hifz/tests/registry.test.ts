import { describe, expect, it } from "vitest";
import { activeTab, modules, tabs } from "@/modules/registry";

describe("registre des modules", () => {
  it("déclare le hifz comme seul module actif pour l'instant", () => {
    expect(modules.filter((m) => m.status === "active").map((m) => m.id)).toEqual(["hifz"]);
  });

  it("garde des identifiants et chemins uniques", () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length);
    expect(new Set(tabs.map((t) => t.href)).size).toBe(tabs.length);
  });

  it("trouve l'onglet actif par préfixe", () => {
    expect(activeTab("/")?.label).toBe("Aujourd'hui");
    expect(activeTab("/hifz/programme")?.label).toBe("Programme");
    expect(activeTab("/hifz/programme/ajouter")?.label).toBe("Programme");
    expect(activeTab("/reglages")?.label).toBe("Réglages");
    expect(activeTab("/inconnu")).toBeUndefined();
  });
});
