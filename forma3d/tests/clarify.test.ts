import { describe, expect, it } from "vitest";
import { AnswersSchema, ClarifyResponseSchema, composePrompt, fallbackQuestions, looksClear, withReferenceQuestion } from "@/lib/clarify-types";

describe("assistant de questions : faut-il poser des questions ?", () => {
  it("ne pose aucune question pour une demande détaillée", () => {
    expect(
      looksClear("Un support de téléphone pour mon bureau en bois, qui laisse passer le câble de charge et incline l'écran à 60 degrés pour les visioconférences"),
    ).toBe(true);
    expect(looksClear("Une étagère murale de 40 cm de large pour ranger mes clés et mon courrier")).toBe(true);
  });

  it("pose des questions pour une demande courte et floue", () => {
    expect(looksClear("un support")).toBe(false);
    expect(looksClear("Une solution pour ranger mes câbles")).toBe(false);
  });

  it("avec une photo, il faut une mesure de référence", () => {
    expect(looksClear("Un cache pour ce câble qui traîne, la prise fait 8 cm", true)).toBe(true);
    expect(looksClear("Un cache pour ce câble qui traîne le long du mur", true)).toBe(false);
    const questions = fallbackQuestions("un cache pour ce câble", true);
    expect(questions[0].id).toBe("reference");
    expect(questions[0].freeText).toBeTruthy();
    expect(ClarifyResponseSchema.safeParse({ needed: true, questions }).success).toBe(true);
    expect(withReferenceQuestion([], "un cache de 8 cm", true)).toEqual([]);
    const three = fallbackQuestions("un support");
    expect(withReferenceQuestion(three, "un support", true)).toHaveLength(3);
    expect(withReferenceQuestion(three, "un support", true)[0].id).toBe("reference");
  });

  it("propose des questions de repli seulement pour les demandes très courtes", () => {
    const questions = fallbackQuestions("un support");
    expect(questions.length).toBeGreaterThanOrEqual(2);
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(ClarifyResponseSchema.safeParse({ needed: true, questions }).success).toBe(true);
    expect(fallbackQuestions("Une solution pour ranger mes câbles de charge")).toEqual([]);
  });
});

describe("réponses de l'utilisateur", () => {
  it("ajoute les précisions à la demande, dans l'ordre", () => {
    const composed = composePrompt("un support", [
      { question: "Où sera-t-il utilisé ?", answer: "À l'intérieur" },
      { question: "Quelle taille ?", answer: "Petit" },
    ]);
    expect(composed).toContain("un support");
    expect(composed.indexOf("À l'intérieur")).toBeLessThan(composed.indexOf("Petit"));
    expect(composePrompt("un support", [])).toBe("un support");
  });

  it("valide les réponses côté serveur : 3 maximum, longueur bornée", () => {
    const one = { question: "Q ?", answer: "R" };
    expect(AnswersSchema.safeParse([one, one, one]).success).toBe(true);
    expect(AnswersSchema.safeParse([one, one, one, one]).success).toBe(false);
    expect(AnswersSchema.safeParse([{ question: "Q ?", answer: "x".repeat(500) }]).success).toBe(false);
    expect(AnswersSchema.safeParse([{ question: "Q ?", answer: "" }]).success).toBe(false);
  });

  it("refuse une réponse de l'IA hors format (trop de questions, pas assez d'options)", () => {
    const q = { id: "a", question: "Une question ?", options: ["oui", "non"] };
    expect(ClarifyResponseSchema.safeParse({ needed: true, questions: [q, q, q, q] }).success).toBe(false);
    expect(ClarifyResponseSchema.safeParse({ needed: true, questions: [{ ...q, options: ["seule"] }] }).success).toBe(false);
  });
});
