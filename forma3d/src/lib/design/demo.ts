import type { Design } from "./schema";
import { CABLE_ORGANIZER, DESK_ORGANIZER, PHONE_STAND, WALL_KEY_SHELF } from "./samples";

/**
 * Générateur de démonstration : choisit le modèle d'exemple le plus proche
 * de la demande. Utilisé quand aucune clé d'IA n'est configurée (clairement signalé à l'écran).
 */
const RULES: { keywords: string[]; design: Design }[] = [
  { keywords: ["câble", "cable", "fil ", "fils", "chargeur", "usb", "cordon", "rallonge", "multiprise"], design: CABLE_ORGANIZER },
  {
    keywords: ["téléphone", "telephone", "phone", "smartphone", "portable", "tablette", "ipad", "support", "socle", "présentoir", "presentoir", "pupitre", "chevalet", "liseuse", "écran", "ecran", "montre", "casque", "manette"],
    design: PHONE_STAND,
  },
  {
    keywords: ["clé", "cle ", "cles", "clés", "clef", "mur", "mural", "entrée", "entree", "crochet", "étagère", "etagere", "patère", "patere", "accroche", "suspendre", "suspension", "porte-manteau", "tablette murale"],
    design: WALL_KEY_SHELF,
  },
  {
    // Objets du quotidien sans exemple dédié : l'organiseur de bureau, présenté comme « exemple le plus proche ».
    keywords: [
      "bureau", "tiroir", "organis", "rangement", "ranger", "range", "stylo", "crayon", "couvert", "trombone", "papier",
      "boîte", "boite", "bac", "plateau", "pot", "casier", "vide-poche", "étui", "etui", "cache", "clip", "pince", "cale",
      "pied", "meuble", "table", "chaise", "entretoise", "bouchon", "couvercle", "poignée", "poignee", "bouton", "adaptateur",
      "guide", "butée", "butee", "protection", "coin", "gobelet", "brosse", "savon", "éponge", "eponge", "épice", "epice",
      "sachet", "porte", "fenêtre", "fenetre", "tiroir", "placard", "cuisine", "salle de bain", "jardin", "outil", "vis",
      "équerre", "equerre", "fixation", "charnière", "charniere", "loquet", "boîtier", "boitier", "jouet", "figurine", "vase",
    ],
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
  note = "Mode démonstration : modèle d'exemple le plus proche de la demande (l'IA n'a pas été utilisée, la pièce ne correspond pas exactement à votre besoin).",
): Design {
  const match = matchDemoDesign(prompt) ?? DESK_ORGANIZER;
  const design: Design = structuredClone(match);
  design.analysis.assumptions = [note, ...design.analysis.assumptions];
  return design;
}
