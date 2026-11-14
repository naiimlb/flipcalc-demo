import type { Design } from "./schema";
import { CABLE_ORGANIZER, DESK_ORGANIZER, PHONE_STAND, WALL_KEY_SHELF } from "./samples";

/**
 * Générateur de démonstration : choisit le modèle d'exemple le plus proche
 * de la demande. Utilisé quand aucune clé d'IA n'est configurée (clairement signalé à l'écran).
 */
const RULES: { keywords: string[]; design: Design }[] = [
  { keywords: ["câble", "cable", "fil", "chargeur", "usb"], design: CABLE_ORGANIZER },
  { keywords: ["téléphone", "telephone", "phone", "smartphone", "portable", "tablette", "ipad"], design: PHONE_STAND },
  { keywords: ["clé", "cle", "clef", "mur", "mural", "entrée", "entree", "crochet", "étagère", "etagere"], design: WALL_KEY_SHELF },
  {
    keywords: ["bureau", "tiroir", "organis", "rangement", "ranger", "stylo", "crayon", "couvert", "trombone", "papier"],
    design: DESK_ORGANIZER,
  },
];

/** Message quand la démonstration n'a aucun exemple qui ressemble à la demande (jamais un modèle sans rapport). */
export const DEMO_NO_MATCH = "Je n'ai pas compris ce besoin.";

function normalize(s: string) {
  return s.toLocaleLowerCase("fr-FR");
}

/** Exemple le plus proche de la demande, ou null si aucun ne correspond. */
export function matchDemoDesign(prompt: string): Design | null {
  const text = normalize(prompt);
  return RULES.find((r) => r.keywords.some((k) => text.includes(k)))?.design ?? null;
}

export function demoDesign(
  prompt: string,
  note = "Mode démonstration : modèle d'exemple le plus proche de la demande (l'IA n'a pas été utilisée).",
): Design {
  const match = matchDemoDesign(prompt) ?? DESK_ORGANIZER;
  const design: Design = structuredClone(match);
  design.analysis.assumptions = [note, ...design.analysis.assumptions];
  return design;
}
