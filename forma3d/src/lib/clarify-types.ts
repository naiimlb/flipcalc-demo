import { z } from "zod";

/* Assistant de questions : types et règles partagés entre le navigateur et le serveur. */

export const MAX_QUESTIONS = 3;
export const MAX_ANSWER_LENGTH = 120;

export const ClarifyQuestionSchema = z
  .object({
    id: z.string().trim().min(1).max(30),
    question: z.string().trim().min(5).max(140),
    options: z.array(z.string().trim().min(1).max(40)).max(5),
    /** Réponse libre (ex. une mesure de référence sur la photo) en plus des éventuels boutons. */
    freeText: z.object({ placeholder: z.string().trim().max(80) }).nullish(),
  })
  .refine((q) => q.options.length >= 2 || Boolean(q.freeText), "Au moins deux réponses à choisir, ou une réponse libre.");
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

export function hasDimension(text: string): boolean {
  return DIMENSION.test(text);
}

/**
 * Une demande est « claire » quand elle est détaillée : on ne pose alors aucune question (et on n'appelle pas l'IA).
 * - 20 mots ou plus ;
 * - 10 mots avec au moins une dimension ou un budget chiffré.
 * Avec une photo, il faut en plus une mesure de référence (sinon les tailles ne peuvent pas être estimées).
 */
export function looksClear(prompt: string, hasImage = false): boolean {
  if (hasImage) return hasDimension(prompt) && wordCount(prompt) >= 6;
  const words = wordCount(prompt);
  if (words >= 20) return true;
  if (words >= 10 && hasDimension(prompt)) return true;
  return false;
}

type Lang = "fr" | "en" | "ar";
const Q = {
  reference: {
    fr: ["Une mesure de référence visible sur la photo ?", "ex. : la prise fait 8 cm de large, la table 80 cm"],
    en: ["A reference measurement visible in the photo?", "e.g. the socket is 8 cm wide, the table 80 cm"],
    ar: ["قياس مرجعي ظاهر في الصورة؟", "مثال: عرض المقبس 8 سم، والطاولة 80 سم"],
  },
  size: {
    fr: ["Quelle taille approximative ?", "Petit (moins de 10 cm)", "Moyen (10 à 30 cm)", "Grand (plus de 30 cm)"],
    en: ["Roughly what size?", "Small (under 10 cm)", "Medium (10 to 30 cm)", "Large (over 30 cm)"],
    ar: ["ما الحجم التقريبي؟", "صغير (أقل من 10 سم)", "متوسط (10 إلى 30 سم)", "كبير (أكثر من 30 سم)"],
  },
  usage: {
    fr: ["Où sera-t-il utilisé ?", "À l'intérieur", "À l'extérieur", "Les deux"],
    en: ["Where will it be used?", "Indoors", "Outdoors", "Both"],
    ar: ["أين سيُستخدم؟", "في الداخل", "في الخارج", "كلاهما"],
  },
  make: {
    fr: ["Comment le fabriquer ?", "Imprimante 3D à la maison", "Service d'impression", "Bois / atelier", "Peu importe"],
    en: ["How will you make it?", "3D printer at home", "Printing service", "Wood / workshop", "No preference"],
    ar: ["كيف ستصنعه؟", "طابعة ثلاثية الأبعاد في المنزل", "خدمة طباعة", "خشب / ورشة", "لا يهم"],
  },
} as const;

const lang = (l?: string): Lang => (l === "en" || l === "ar" ? l : "fr");

/** Mesure de référence demandée pour une photo : sert à estimer les tailles réelles. */
export function referenceQuestion(language?: string): ClarifyQuestion {
  const [question, placeholder] = Q.reference[lang(language)];
  return { id: "reference", question, options: [], freeText: { placeholder } };
}

function choiceQuestion(id: "size" | "usage" | "make", language?: string): ClarifyQuestion {
  const [question, ...options] = Q[id][lang(language)];
  return { id: id === "size" ? "taille" : id === "make" ? "fabrication" : "usage", question, options: [...options] };
}

/** Ajoute la question de mesure de référence (photo sans cote dans la demande), en restant à 3 questions. */
export function withReferenceQuestion(questions: ClarifyQuestion[], prompt: string, hasImage: boolean, language?: string): ClarifyQuestion[] {
  if (!hasImage || hasDimension(prompt) || questions.some((q) => q.freeText)) return questions.slice(0, MAX_QUESTIONS);
  return [referenceQuestion(language), ...questions.filter((q) => q.id !== "taille")].slice(0, MAX_QUESTIONS);
}

/**
 * Questions de repli (sans IA) pour une demande très courte :
 * utilisées quand l'IA n'est pas disponible, pour que l'assistant fonctionne quand même.
 */
export function fallbackQuestions(prompt: string, hasImage = false, language?: string): ClarifyQuestion[] {
  if (hasImage) {
    return withReferenceQuestion(wordCount(prompt) < 8 ? [choiceQuestion("usage", language)] : [], prompt, true, language);
  }
  if (wordCount(prompt) >= 8) return [];
  return [choiceQuestion("size", language), choiceQuestion("usage", language), choiceQuestion("make", language)];
}

/** Texte ajouté à la demande pour l'IA et pour la clé du cache (ordre des réponses conservé). */
export function composePrompt(prompt: string, answers: Answer[]): string {
  if (!answers.length) return prompt;
  return `${prompt}\n\nPrécisions de l'utilisateur :\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`;
}
