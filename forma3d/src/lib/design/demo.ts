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
];

function normalize(s: string) {
  return s.toLocaleLowerCase("fr-FR");
}

export function demoDesign(
  prompt: string,
  note = "Mode démonstration : modèle d'exemple le plus proche de la demande (l'IA n'a pas été utilisée).",
): Design {
  const text = normalize(prompt);
  const match = RULES.find((r) => r.keywords.some((k) => text.includes(k)))?.design ?? DESK_ORGANIZER;
  const design: Design = structuredClone(match);
  design.analysis.assumptions = [note, ...design.analysis.assumptions];
  return design;
}
