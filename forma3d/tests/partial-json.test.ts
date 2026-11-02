import { describe, expect, it } from "vitest";
import { DESIGN_SECTIONS, parsePartialJson, progressChanged, progressFromText } from "@/lib/design/partial-json";
import { DESIGN_JSON_SCHEMA } from "@/lib/design/schema";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";

const full = JSON.stringify(SAMPLE_DESIGNS[0].design);

describe("lecture d'un JSON en cours d'écriture", () => {
  it("ne plante jamais, quel que soit l'endroit où la réponse est coupée, et converge vers le JSON complet", () => {
    for (let cut = 0; cut <= full.length; cut += 7) {
      expect(() => parsePartialJson(full.slice(0, cut))).not.toThrow();
    }
    expect(parsePartialJson(full)).toEqual(JSON.parse(full));
  });

  it("garde le texte déjà écrit d'une chaîne ouverte", () => {
    const partial = parsePartialJson('{"title":"Support","analysis":{"summary":"Le téléphone glisse sur le bu') as {
      analysis: { summary: string };
    };
    expect(partial.analysis.summary).toBe("Le téléphone glisse sur le bu");
  });

  it("retire les fragments incomplets (clé sans valeur, nombre ou littéral tronqué, virgule pendante)", () => {
    expect(parsePartialJson('{"a":1,"b"')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":1,"b":')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":1,"b":tru')).toEqual({ a: 1 });
    expect(parsePartialJson('{"a":[1,2,')).toEqual({ a: [1, 2] });
    expect(parsePartialJson('{"a":"x\\')).toEqual({ a: "x" });
    expect(parsePartialJson("```json\n{\"a\":2")).toEqual({ a: 2 });
  });

  it("renvoie undefined tant qu'il n'y a rien d'exploitable", () => {
    expect(parsePartialJson("")).toBeUndefined();
    expect(parsePartialJson("Voici la conception")).toBeUndefined();
  });
});

describe("avancement affiché pendant la génération", () => {
  it("expose l'analyse en direct et les rubriques terminées dans l'ordre", () => {
    const design = SAMPLE_DESIGNS[0].design;
    const text = JSON.stringify({ title: design.title, category: design.category, difficulty: design.difficulty, analysis: design.analysis, solution: design.solution });
    // Coupé au début de « solution » : l'analyse est terminée, la solution est en cours.
    const midSolution = text.slice(0, text.indexOf('"solution"') + 40);
    const progress = progressFromText(midSolution)!;
    expect(progress.title).toBe(design.title);
    expect(progress.analysis?.summary).toBe(design.analysis.summary);
    expect(progress.done).toContain("analysis");
    expect(progress.done).not.toContain("solution");
    // Objet complet : tout est terminé.
    expect(progressFromText(text)!.done).toContain("solution");
  });

  it("suit l'ordre des rubriques du schéma", () => {
    const keys = Object.keys((DESIGN_JSON_SCHEMA as unknown as { properties: Record<string, unknown> }).properties);
    const order = DESIGN_SECTIONS.map((s) => keys.indexOf(s.key));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("détecte ce qui change pour ne pas envoyer d'évènement inutile", () => {
    const a = progressFromText('{"title":"A","analysis":{"summary":"un')!;
    const b = progressFromText('{"title":"A","analysis":{"summary":"un deux')!;
    expect(progressChanged(null, a)).toBe(true);
    expect(progressChanged(a, a)).toBe(false);
    expect(progressChanged(a, b)).toBe(true);
  });
});
