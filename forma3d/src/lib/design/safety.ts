/**
 * Pièces critiques (phase 2) : certaines demandes engagent la sécurité des personnes. Une pièce imprimée en 3D
 * par un particulier n'offre aucune garantie de résistance : on refuse ce qui retient ou porte une personne en cas
 * de chute ou de choc, et l'on avertit clairement pour les usages sensibles.
 * Vérification par mots-clés, partagée par le navigateur et le serveur (aucun appel à l'IA).
 */

export type SafetyLevel = "refuse" | "warn";

export interface SafetyVerdict {
  level: SafetyLevel;
  /** Phrase affichée telle quelle. */
  message: string;
}

const RULES: { level: SafetyLevel; pattern: RegExp; message: string }[] = [
  // Filtre de contenu (phase 4) : armes et contenus protégés.
  {
    level: "refuse",
    pattern:
      /\b(armes?( à feu| blanches?)?|pistolets?|revolvers?|fusils?|carabines?|silencieux|munitions?|cartouches? de (fusil|pistolet)|chargeurs? (de |d'|pour )(pistolet|fusil|arme)|canons? de (pistolet|fusil)|poings? am[eé]ricains?|couteaux? papillon|matraques?|ghost gun|glock|ar-?15|ak-?47)\b/i,
    message: "Je ne conçois pas d'armes ni de pièces d'armes.",
  },
  {
    level: "refuse",
    pattern:
      /\b(pok[eé]mon|pikachu|mickey|minnie|disney|marvel|spider-?man|batman|superman|star wars|dark vador|yoda|mario|luigi|zelda|sonic|harry potter|minecraft|hello kitty|naruto|one piece|dragon ball)\b|\blogos? (de |d'|du |de la )?(nike|adidas|apple|ferrari|porsche|mercedes|bmw|coca-?cola|mcdonald|chanel|gucci|louis vuitton|lego|nintendo|playstation|xbox)\b/i,
    message: "Je ne reproduis pas de personnages, de logos ou de marques protégés. Décrivez plutôt la fonction de l'objet (par exemple « un support pour manette »).",
  },
  {
    level: "refuse",
    pattern: /\b(harnais|baudrier|mousquetons?|assurage|prises? d'escalade|escalade)\b/i,
    message: "Je ne conçois pas de pièces d'escalade ou d'assurage : elles retiennent une personne en cas de chute, et une pièce imprimée n'offre aucune garantie.",
  },
  {
    level: "refuse",
    pattern: /\b(si[eè]ge (auto|enfant|b[eé]b[eé])|rehausseur|casques?)\b/i,
    message: "Je ne conçois pas d'équipement de protection (siège enfant, casque…) : seuls des produits certifiés protègent en cas de choc.",
  },
  {
    level: "refuse",
    pattern: /\b(freins?|plaquettes?|[eé]triers?|rotules?|biellettes?|suspensions?) (de |d'|du |pour )?(la |une |ma |mon )?(v[eé]lo|voiture|moto|scooter|trottinette|auto|v[eé]hicule)\b|\b(v[eé]lo|voiture|moto|scooter|trottinette) .{0,30}\b(freins?|rotules?|direction|suspension)\b/i,
    message: "Je ne conçois pas de pièces de freinage, de direction ou de suspension : leur rupture peut provoquer un accident.",
  },
  {
    level: "refuse",
    pattern: /\b(levage|palans?|[eé]lingues?|sangles? de levage|crochets? de levage)\b/i,
    message: "Je ne conçois pas de pièces de levage : une charge suspendue qui tombe peut blesser gravement.",
  },
  {
    level: "warn",
    pattern: /\b(garde-corps|rambardes?|[eé]chelles?|marchepieds?|tabourets?|chaises?|balan[cç]oires?|hamacs?|porter (une|un) (personne|adulte|enfant))\b/i,
    message: "Pièce qui porte une personne : une impression 3D peut casser sans prévenir. Ne vous asseyez pas et ne montez pas dessus sans l'avoir fait vérifier et testé avec une marge importante.",
  },
  {
    level: "warn",
    pattern: /\b(gaz|sous pression|cocotte|chaudi[eè]re|230 ?v|secteur|prises? [eé]lectriques?|disjoncteurs?|tableau [eé]lectrique)\b/i,
    message: "Usage sensible (gaz, pression ou électricité du secteur) : n'utilisez jamais cette pièce comme élément de sécurité, et faites intervenir un professionnel pour toute installation.",
  },
  {
    level: "warn",
    pattern: /\b(proth[eè]ses?|attelles?|implants?|m[eé]dical(e|es|aux)?|orth[eè]ses?)\b/i,
    message: "Usage médical : une pièce imprimée n'est pas un dispositif médical. Demandez l'avis d'un professionnel de santé avant de l'utiliser.",
  },
  {
    level: "warn",
    pattern: /\b(jouets?|b[eé]b[eé]s?|t[eé]tines?|moins de 3 ans)\b/i,
    message: "Objet pour enfant : évitez les petites pièces détachables (risque d'étouffement) et préférez une matière adaptée ; une impression 3D ne remplace pas un jouet certifié.",
  },
];

/** Verdict de sécurité pour une demande (le plus strict l'emporte), ou null. */
export function safetyVerdict(text: string): SafetyVerdict | null {
  const matches = RULES.filter((r) => r.pattern.test(text));
  const rule = matches.find((r) => r.level === "refuse") ?? matches[0];
  return rule ? { level: rule.level, message: rule.message } : null;
}
