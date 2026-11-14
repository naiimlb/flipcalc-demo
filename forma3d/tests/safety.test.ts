import { describe, expect, it } from "vitest";
import { safetyVerdict } from "@/lib/design/safety";

describe("pièces critiques", () => {
  it("refuse ce qui retient ou protège une personne", () => {
    for (const text of ["un mousqueton pour l'escalade", "une pièce pour le siège auto de mon fils", "une plaquette de frein de vélo", "un crochet de levage pour 200 kg", "un casque de vélo"]) {
      expect(safetyVerdict(text)?.level, text).toBe("refuse");
    }
  });

  it("refuse les armes et les contenus protégés", () => {
    for (const text of ["un chargeur pour pistolet", "une crosse de fusil", "une figurine Pikachu", "le logo de Nike en 3D", "un poing américain"]) {
      expect(safetyVerdict(text)?.level, text).toBe("refuse");
    }
  });

  it("n'empêche pas les objets compatibles avec une marque", () => {
    for (const text of ["un support pour ma manette Xbox", "un étui pour Apple Watch", "un chargeur pour mon téléphone", "une boîte pour mes Lego"]) {
      expect(safetyVerdict(text), text).toBeNull();
    }
  });

  it("avertit pour les usages sensibles", () => {
    for (const text of ["un tabouret pour la cuisine", "un cache pour une prise électrique", "une attelle de doigt", "un jouet pour bébé"]) {
      expect(safetyVerdict(text)?.level, text).toBe("warn");
    }
  });

  it("laisse passer les demandes courantes (pas de faux positifs sur les idées proposées)", () => {
    for (const text of [
      "Un support pour mon téléphone sur le vélo",
      "Un range-câbles pour les chargeurs posés sur mon bureau",
      "Un cache pour un trou de 35 mm dans mon bureau",
      "Un pied de meuble pour caler une table bancale de 8 mm",
      "Un organiseur pour ranger les couverts dans un tiroir",
      "Un clip pour fermer un sachet de café",
      "un porte-clés mural",
    ]) {
      expect(safetyVerdict(text), text).toBeNull();
    }
  });
});
