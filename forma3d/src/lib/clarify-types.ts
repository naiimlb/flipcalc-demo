import { z } from "zod";

/* Assistant de questions : types et règles partagés entre le navigateur et le serveur. */

export const MAX_QUESTIONS = 3;
export const MAX_ANSWER_LENGTH = 120;

export const ClarifyQuestionSchema = z.object({
  id: z.string().trim().min(1).max(30),
  question: z.string().trim().min(5).max(140),
  options: z.array(z.string().trim().min(1).max(40)).min(2).max(5),
});
export type ClarifyQuestion = z.infer<typeof ClarifyQuestionSchema>;

export const ClarifyResponseSchema = z.object({
  needed: z.boolean(),
  questions: z.array(ClarifyQuestionSchema).max(MAX_QUESTIONS),
});
export type ClarifyResponse = z.infer<typeof ClarifyResponseSchema>;

/** Réponse donnée par l'utilisateur à une question (« Passer » n'envoie rien). */
export const AnswerSchema = z.object({
  question: z.string().trim().min(1).max(140),
  answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
});
export type Answer = z.infer<typeof AnswerSchema>;
export const AnswersSchema = z.array(AnswerSchema).max(MAX_QUESTIONS);

const DIMENSION = /\b\d+([.,]\d+)?\s?(mm|cm|m|po|pouces?|inch|"|kg|g|€|euros?)\b/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Une demande est « claire » quand elle est détaillée : on ne pose alors aucune question (et on n'appelle pas l'IA).
 * - 20 mots ou plus ;
 * - 10 mots avec au moins une dimension ou un budget chiffré ;
 * - avec une photo jointe, 6 mots suffisent (la photo apporte le contexte).
 */
export function looksClear(prompt: string, hasImage = false): boolean {
  const words = wordCount(prompt);
  if (words >= 20) return true;
  if (hasImage && words >= 6) return true;
  if (words >= 10 && DIMENSION.test(prompt)) return true;
  return false;
}

/**
 * Questions de repli (sans IA) pour une demande très courte :
 * utilisées quand l'IA n'est pas disponible, pour que l'assistant fonctionne quand même.
 */
export function fallbackQuestions(prompt: string): ClarifyQuestion[] {
  if (wordCount(prompt) >= 8) return [];
  return [
    { id: "taille", question: "Quelle taille approximative ?", options: ["Petit (moins de 10 cm)", "Moyen (10 à 30 cm)", "Grand (plus de 30 cm)"] },
    { id: "usage", question: "Où sera-t-il utilisé ?", options: ["À l'intérieur", "À l'extérieur", "Les deux"] },
    { id: "fabrication", question: "Comment le fabriquer ?", options: ["Imprimante 3D à la maison", "Service d'impression", "Bois / atelier", "Peu importe"] },
  ];
}

/** Texte ajouté à la demande pour l'IA et pour la clé du cache (ordre des réponses conservé). */
export function composePrompt(prompt: string, answers: Answer[]): string {
  if (!answers.length) return prompt;
  return `${prompt}\n\nPrécisions de l'utilisateur :\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`;
}
