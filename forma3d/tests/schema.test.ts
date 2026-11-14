/* eslint-disable @typescript-eslint/no-explicit-any -- objets volontairement malformés */
import { describe, expect, it } from "vitest";
import { DESIGN_JSON_SCHEMA, extractJson, normalizeRecommendedMaterials, validateDesign, type RecommendedMaterial } from "@/lib/design/schema";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { demoDesign, matchDemoDesign } from "@/lib/design/demo";

type JsonNode = { type?: string; properties?: Record<string, JsonNode>; required?: string[]; additionalProperties?: boolean; items?: JsonNode };

function walk(node: JsonNode, path: string, visit: (n: JsonNode, p: string) => void) {
  visit(node, path);
  if (node.properties) for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`, visit);
  if (node.items) walk(node.items, `${path}[]`, visit);
}

describe("schéma JSON envoyé à Claude", () => {
  it("respecte les contraintes des sorties structurées (objets fermés, tous les champs requis)", () => {
    walk(DESIGN_JSON_SCHEMA as JsonNode, "$", (node, path) => {
      if (node.type === "object") {
        expect(node.additionalProperties, path).toBe(false);
        expect([...(node.required ?? [])].sort(), path).toEqual(Object.keys(node.properties ?? {}).sort());
      }
      // Pas de contraintes numériques ni de longueur (non prises en charge par l'API).
      for (const forbidden of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) {
        expect(node, path).not.toHaveProperty(forbidden);
      }
    });
  });
});

describe("validateDesign", () => {
  it("accepte tous les exemples", () => {
    for (const sample of SAMPLE_DESIGNS) {
      const result = validateDesign(sample.design);
      expect(result.ok, sample.id).toBe(true);
    }
  });

  it("normalise les valeurs hors bornes, les couleurs et les identifiants", () => {
    const input = structuredClone(SAMPLE_DESIGNS[0].design) as unknown as Record<string, any>;
    input.model.parts[0].color = "rouge";
    input.model.parts[0].size.x = 1e9;
    input.model.parts[0].position.y = -1e9;
    input.model.parts[1].id = input.model.parts[0].id;
    input.model.parts.push({ ...input.model.parts[0], id: "", shape: "extrusion", profile: [] });
    input.cost.min = 10;
    input.cost.max = 2;
    const result = validateDesign(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first, second] = result.design.model.parts;
    expect(first.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.size.x).toBe(5000);
    expect(first.position.y).toBe(-5000);
    expect(second.id).not.toBe(first.id);
    expect(new Set(result.design.model.parts.map((p) => p.id)).size).toBe(result.design.model.parts.length);
    expect(result.design.model.parts.at(-1)?.shape).toBe("box");
    expect(result.design.cost.max).toBe(10);
  });

  it("refuse une conception sans pièce ou avec une forme inconnue", () => {
    const empty = structuredClone(SAMPLE_DESIGNS[0].design) as unknown as Record<string, any>;
    empty.model.parts = [];
    expect(validateDesign(empty).ok).toBe(false);
    const unknownShape = structuredClone(SAMPLE_DESIGNS[0].design) as unknown as Record<string, any>;
    unknownShape.model.parts[0].shape = "dodecahedron";
    const result = validateDesign(unknownShape);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("model.parts.0.shape");
  });

  it("limite le nombre de pièces", () => {
    const many = structuredClone(SAMPLE_DESIGNS[0].design) as unknown as Record<string, any>;
    many.model.parts = Array.from({ length: 200 }, (_, i) => ({ ...many.model.parts[0], id: `p${i}` }));
    const result = validateDesign(many);
    expect(result.ok && result.design.model.parts.length).toBe(60);
  });
});

describe("extractJson", () => {
  it("lit un JSON pur ou entouré de texte", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Voici :\n{"a":{"b":2}}\nFin')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("pas de json")).toThrow();
  });
});

describe("générateur de démonstration", () => {
  it("choisit le modèle selon les mots-clés et le signale", () => {
    expect(demoDesign("Ranger mes câbles USB").title).toBe(SAMPLE_DESIGNS[1].design.title);
    expect(demoDesign("un support pour mon téléphone").title).toBe(SAMPLE_DESIGNS[0].design.title);
    expect(demoDesign("je perds mes clés").title).toBe(SAMPLE_DESIGNS[2].design.title);
    // Jamais de modèle sans rapport : une demande absurde ne correspond à aucun exemple.
    expect(matchDemoDesign("fjqz xkcd plumeau galactique")).toBeNull();
    expect(matchDemoDesign("un organiseur de tiroir pour les couverts")).not.toBeNull();
    const other = demoDesign("quelque chose d'autre");
    expect(other.title).toBe(SAMPLE_DESIGNS[3].design.title);
    expect(other.analysis.assumptions[0]).toContain("démonstration");
    // Les exemples d'origine ne sont pas modifiés.
    expect(SAMPLE_DESIGNS[3].design.analysis.assumptions[0]).not.toContain("démonstration");
  });
});

describe("matières conseillées", () => {
  it("chaque exemple propose au moins 3 matières, dont une alternative économique moins chère que la recommandée", () => {
    for (const { id, design } of SAMPLE_DESIGNS) {
      const list = design.materiaux_conseilles;
      expect(list.length, id).toBeGreaterThanOrEqual(3);
      const eco = list.filter((m) => m.alternative_economique);
      expect(eco.length, id).toBe(1);
      expect(eco[0].cout_indicatif, id).toBeLessThan(list[0].cout_indicatif);
      expect(design.criteres_materiaux, id).not.toBeNull();
    }
  });

  it("une conception sans matières conseillées (ancien format) reste valide", () => {
    const old = structuredClone(SAMPLE_DESIGNS[0].design) as unknown as Record<string, any>;
    delete old.materiaux_conseilles;
    delete old.criteres_materiaux;
    const result = validateDesign(old);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.design.materiaux_conseilles).toEqual([]);
      expect(result.design.criteres_materiaux).toBeNull();
    }
  });

  it("garde une seule alternative économique, ou désigne la moins chère", () => {
    const base = SAMPLE_DESIGNS[0].design.materiaux_conseilles[0];
    const mk = (nom: string, cout: number, eco = false): RecommendedMaterial => ({ ...base, nom, cout_indicatif: cout, alternative_economique: eco });
    const twoFlags = [mk("A", 10), mk("B", 5, true), mk("C", 3, true)];
    normalizeRecommendedMaterials(twoFlags);
    expect(twoFlags.map((m) => m.alternative_economique)).toEqual([false, true, false]);
    const none = [mk("A", 10), mk("B", 8), mk("C", 4)];
    normalizeRecommendedMaterials(none);
    expect(none.map((m) => m.alternative_economique)).toEqual([false, false, true]);
  });

  it("le schéma JSON envoyé à Claude exige les matières conseillées", () => {
    const root = DESIGN_JSON_SCHEMA as { required: string[] };
    expect(root.required).toContain("materiaux_conseilles");
    expect(root.required).toContain("criteres_materiaux");
  });
});
