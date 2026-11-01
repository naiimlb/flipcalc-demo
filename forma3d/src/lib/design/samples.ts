import type { Design, MaterialKind, Part, Shape } from "./schema";

/**
 * Conceptions d'exemple, écrites à la main.
 * Elles servent de vitrine aux visiteurs non connectés et de « générateur de démo »
 * quand aucune clé d'IA n'est configurée.
 */

type V = [number, number, number];

function part(
  id: string,
  name: string,
  role: string,
  shape: Shape,
  size: V,
  position: V,
  opts: {
    rotation?: V;
    color?: string;
    material?: MaterialKind;
    cornerRadius?: number;
    profile?: [number, number][];
    holes?: [number, number][][];
  } = {},
): Part {
  const [sx, sy, sz] = size;
  const [px, py, pz] = position;
  const [rx, ry, rz] = opts.rotation ?? [0, 0, 0];
  return {
    id,
    name,
    role,
    shape,
    size: { x: sx, y: sy, z: sz },
    position: { x: px, y: py, z: pz },
    rotation: { x: rx, y: ry, z: rz },
    cornerRadius: opts.cornerRadius ?? 0,
    profile: (opts.profile ?? []).map(([x, y]) => ({ x, y })),
    holes: (opts.holes ?? []).map((ring) => ring.map(([x, y]) => ({ x, y }))),
    color: opts.color ?? "#7b5ce6",
    material: opts.material ?? "plastic",
  };
}

/* ----------------------------- Câbles ----------------------------- */

const teeth = [-70, -42, -14, 14, 42, 70].map((x, i) =>
  part(`dent-${i + 1}`, `Séparateur ${i + 1}`, "Maintient un câble dans sa fente", "box", [8, 30, 46], [x, 29, 0], {
    cornerRadius: 3.5,
    color: "#6c63ff",
  }),
);

export const CABLE_ORGANIZER: Design = {
  title: "Peigne range-câbles lesté",
  category: "Rangement de bureau",
  difficulty: "facile",
  analysis: {
    summary:
      "Les câbles de charge glissent derrière le bureau dès qu'on les débranche. Il faut les garder à portée de main, séparés et repérables, sans perçage.",
    needs: ["Retenir 5 câbles de 3 à 6 mm", "Ne pas bouger quand on tire un câble", "Se poser sans outil"],
    constraints: ["Encombrement inférieur à 17 cm", "Imprimable sans support", "Coût minimal"],
    assumptions: ["Câbles USB-C / Lightning standard (Ø 3,5 à 5 mm)", "Bureau en bois ou mélaminé"],
  },
  solution: {
    concept: "Un peigne à 5 fentes posé sur une semelle antidérapante, lesté par une base pleine.",
    howItWorks:
      "Chaque câble se clipse dans une fente plus étroite que son connecteur : il ne peut plus tomber derrière le bureau. La semelle en caoutchouc empêche le peigne de glisser.",
    keyFeatures: ["5 fentes de 6 mm", "Arêtes arrondies, sans accroche", "Semelle antidérapante", "Impression en 2 h"],
  },
  dimensions: { width: 160, depth: 60, height: 44, weightGrams: 95, notes: "Fentes de 6 mm : resserrer à 5 mm pour des câbles fins." },
  materials: [
    { name: "PLA mat", usage: "Base et séparateurs", quantity: "≈ 85 g", color: "#6c63ff" },
    { name: "Caoutchouc adhésif", usage: "Semelle antidérapante", quantity: "1 bande 150 × 54 mm", color: "#2b2b33" },
  ],
  fabrication: [
    { title: "Trancher le modèle", detail: "Remplissage 30 %, 3 périmètres, couche de 0,2 mm.", tool: "Trancheur (Cura, PrusaSlicer)", durationMin: 5 },
    { title: "Imprimer", detail: "Base à plat sur le plateau, aucun support nécessaire.", tool: "Imprimante 3D FDM", durationMin: 120 },
    { title: "Ébavurer les fentes", detail: "Passer une lime douce dans chaque fente.", tool: "Lime", durationMin: 5 },
    { title: "Coller la semelle", detail: "Dégraisser la base puis coller la bande de caoutchouc.", tool: "Ciseaux", durationMin: 5 },
  ],
  cost: {
    currency: "EUR",
    min: 2,
    max: 4,
    items: [
      { label: "Filament PLA (85 g)", amount: 1.9 },
      { label: "Bande caoutchouc", amount: 1.2 },
    ],
    notes: "Hors amortissement de l'imprimante.",
  },
  recommendations: [
    "Imprimer en PETG si le bureau est exposé au soleil.",
    "Ajouter des étiquettes sur la face avant pour repérer chaque câble.",
    "Version murale : ajouter deux trous fraisés dans la base.",
  ],
  model: {
    parts: [
      part("semelle", "Semelle", "Antidérapant sous la base", "box", [150, 2, 54], [0, 1, 0], {
        cornerRadius: 0.8,
        color: "#2b2b33",
        material: "rubber",
      }),
      part("base", "Base lestée", "Donne du poids et relie les séparateurs", "box", [160, 12, 60], [0, 8, 0], {
        cornerRadius: 5,
        color: "#5b6ee1",
      }),
      ...teeth,
    ],
  },
};

/* --------------------------- Téléphone ---------------------------- */

const STAND_PROFILE: [number, number][] = [
  [-55, -45],
  [50, -45],
  [50, -37],
  [14, 45],
  [2, 45],
  [-38, -33],
  [-44, -33],
  [-44, -22],
  [-55, -22],
];

export const PHONE_STAND: Design = {
  title: "Support de téléphone incliné",
  category: "Support",
  difficulty: "facile",
  analysis: {
    summary:
      "Le téléphone posé à plat sur le bureau oblige à se pencher pour lire les notifications et gêne la charge. Il faut le maintenir incliné, chargeur branché.",
    needs: ["Inclinaison confortable pour la lecture", "Passage du câble de charge", "Stabilité pendant la saisie"],
    constraints: ["Compatible avec une coque", "Téléphones de 65 à 80 mm de large", "Pas de pièces mobiles"],
    assumptions: ["Téléphone de 6 à 6,7 pouces", "Coque d'épaisseur maximale 3 mm"],
  },
  solution: {
    concept: "Deux flasques latérales inclinées à 63°, reliées par une semelle, avec un passage central pour le câble.",
    howItWorks:
      "Le bas du téléphone se loge dans la gorge avant, le dos s'appuie sur deux patins souples. L'espace libre entre les flasques laisse passer le connecteur de charge.",
    keyFeatures: ["Inclinaison 63°", "Gorge de 6 mm compatible coque", "Passage de câble central", "Patins anti-rayures"],
  },
  dimensions: { width: 80, depth: 105, height: 93, weightGrams: 120, notes: "Élargir la gorge à 8 mm pour les coques épaisses." },
  materials: [
    { name: "PETG", usage: "Flasques, semelle et traverses", quantity: "≈ 110 g", color: "#7b5ce6" },
    { name: "TPU 95A", usage: "Patins d'appui et pieds", quantity: "≈ 8 g", color: "#ff6fb5" },
  ],
  fabrication: [
    { title: "Imprimer les flasques", detail: "Couchées sur le flanc, 4 périmètres pour la rigidité.", tool: "Imprimante 3D FDM", durationMin: 150 },
    { title: "Imprimer semelle et traverses", detail: "À plat, remplissage 25 %.", tool: "Imprimante 3D FDM", durationMin: 60 },
    { title: "Imprimer les patins en TPU", detail: "Vitesse réduite (20 mm/s).", tool: "Imprimante 3D FDM", durationMin: 25 },
    { title: "Assembler", detail: "Coller flasques et traverses (colle cyanoacrylate), puis les patins.", tool: "Colle, serre-joints", durationMin: 20 },
  ],
  cost: {
    currency: "EUR",
    min: 3,
    max: 6,
    items: [
      { label: "PETG (110 g)", amount: 2.6 },
      { label: "TPU (8 g)", amount: 0.4 },
      { label: "Colle", amount: 1 },
    ],
    notes: "Version monobloc possible pour supprimer le collage.",
  },
  recommendations: [
    "Pour une tablette, multiplier toutes les cotes par 1,6.",
    "Vérifier que le connecteur de charge coudé passe dans l'espace central.",
  ],
  model: {
    parts: [
      ...[-30, 30].flatMap((x, i) => [
        part(`pied-av-${i + 1}`, `Pied avant ${i + 1}`, "Antidérapant", "cylinder", [12, 3, 12], [x, 1.5, 40], {
          color: "#ff6fb5",
          material: "rubber",
        }),
        part(`pied-ar-${i + 1}`, `Pied arrière ${i + 1}`, "Antidérapant", "cylinder", [12, 3, 12], [x, 1.5, -40], {
          color: "#ff6fb5",
          material: "rubber",
        }),
      ]),
      part("semelle", "Semelle", "Relie les deux flasques", "box", [80, 8, 105], [0, 7, 2.5], { cornerRadius: 4, color: "#5b6ee1" }),
      ...[-34, 34].map((x, i) =>
        part(`flasque-${i + 1}`, `Flasque ${i === 0 ? "gauche" : "droite"}`, "Porte le téléphone incliné", "extrusion", [0, 0, 12], [x, 48, 0], {
          rotation: [0, 90, 0],
          profile: STAND_PROFILE,
          color: "#7b5ce6",
        }),
      ),
      ...[-22, 22].map((x, i) =>
        part(`levre-${i + 1}`, `Lèvre avant ${i + 1}`, "Retient le bas du téléphone", "box", [24, 15, 11], [x, 18.5, 49.5], {
          cornerRadius: 2,
          color: "#7b5ce6",
        }),
      ),
      part("traverse", "Traverse arrière", "Rigidifie l'ensemble", "box", [80, 10, 10], [0, 16, -45], { cornerRadius: 2, color: "#5b6ee1" }),
      ...[-22, 22].map((x, i) =>
        part(`patin-${i + 1}`, `Patin d'appui ${i + 1}`, "Contact souple avec le dos du téléphone", "box", [24, 3, 70], [x, 55, 19], {
          rotation: [62.9, 0, 0],
          cornerRadius: 1,
          color: "#ff6fb5",
          material: "rubber",
        }),
      ),
    ],
  },
};

/* ---------------------------- Mural ------------------------------- */

const BRACKET_PROFILE: [number, number][] = [
  [22.5, 23],
  [-47.5, 23],
  [22.5, -37],
];

export const WALL_KEY_SHELF: Design = {
  title: "Vide-poche mural à crochets",
  category: "Entrée",
  difficulty: "moyen",
  analysis: {
    summary:
      "Les clés, lunettes et le courrier s'accumulent sur le meuble d'entrée et se perdent. Il faut un point de dépôt unique, visible en sortant.",
    needs: ["Accrocher 4 trousseaux", "Poser lunettes et courrier", "Fixation murale discrète"],
    constraints: ["Profondeur limitée (couloir)", "Supporter 3 kg", "Fixation sur placo ou béton"],
    assumptions: ["Mur plein ou placo avec chevilles adaptées", "Largeur disponible ≥ 35 cm"],
  },
  solution: {
    concept: "Un dosseret en chêne avec tablette sur deux équerres et quatre crochets à bout boule.",
    howItWorks:
      "Les clés se suspendent aux crochets, la tablette reçoit lunettes et courrier. Deux vis cachées sous la tablette fixent l'ensemble au mur.",
    keyFeatures: ["4 crochets laiton", "Tablette de 8 cm", "Fixations invisibles", "Bois massif huilé"],
  },
  dimensions: { width: 300, depth: 95, height: 180, weightGrams: 1400, notes: "Entraxe des fixations : 200 mm." },
  materials: [
    { name: "Chêne massif 15 mm", usage: "Dosseret et tablette", quantity: "1 planche 600 × 200 mm", color: "#b98a5a" },
    { name: "Laiton", usage: "Crochets", quantity: "4 tiges Ø 8 × 30 mm + 4 boules", color: "#d9b45a" },
    { name: "Acier", usage: "Équerres", quantity: "2 équerres 70 × 60 mm", color: "#8f96a3" },
  ],
  fabrication: [
    { title: "Débiter le bois", detail: "Dosseret 300 × 180, tablette 300 × 80. Poncer au grain 120 puis 180.", tool: "Scie circulaire, ponceuse", durationMin: 45 },
    { title: "Percer", detail: "4 trous Ø 8 pour les crochets, 2 trous fraisés pour la fixation.", tool: "Perceuse à colonne", durationMin: 20 },
    { title: "Assembler", detail: "Visser les équerres, coller les crochets à l'époxy.", tool: "Visseuse", durationMin: 30 },
    { title: "Finition", detail: "Deux couches d'huile dure, égrenage entre les couches.", tool: "Chiffon", durationMin: 40 },
    { title: "Poser", detail: "Tracer à niveau, cheviller, visser.", tool: "Niveau, perceuse", durationMin: 15 },
  ],
  cost: {
    currency: "EUR",
    min: 28,
    max: 45,
    items: [
      { label: "Planche de chêne", amount: 18 },
      { label: "Crochets laiton", amount: 9 },
      { label: "Équerres + visserie", amount: 6 },
      { label: "Huile dure", amount: 5 },
    ],
    notes: "Version pin : environ 15 €.",
  },
  recommendations: [
    "Sur placo, utiliser des chevilles métalliques à expansion.",
    "Ajouter un petit rebord sur la tablette pour retenir les objets ronds.",
  ],
  model: {
    parts: [
      part("dosseret", "Dosseret", "Support principal fixé au mur", "box", [300, 180, 15], [0, 90, 0], {
        cornerRadius: 3,
        color: "#b98a5a",
        material: "wood",
      }),
      part("tablette", "Tablette", "Reçoit lunettes et courrier", "box", [300, 12, 80], [0, 174, 47.5], {
        cornerRadius: 3,
        color: "#c99a6a",
        material: "wood",
      }),
      ...[-120, 120].map((x, i) =>
        part(`equerre-${i + 1}`, `Équerre ${i + 1}`, "Soutient la tablette", "extrusion", [0, 0, 6], [x, 145, 30], {
          rotation: [0, 90, 0],
          profile: BRACKET_PROFILE,
          color: "#8f96a3",
          material: "metal",
        }),
      ),
      ...[-90, -30, 30, 90].flatMap((x, i) => [
        part(`crochet-${i + 1}`, `Crochet ${i + 1}`, "Accroche un trousseau", "capsule", [8, 34, 8], [x, 60, 24], {
          rotation: [90, 0, 0],
          color: "#d9b45a",
          material: "metal",
        }),
        part(`boule-${i + 1}`, `Boule ${i + 1}`, "Empêche le trousseau de glisser", "sphere", [13, 13, 13], [x, 60, 42], {
          color: "#e6c46d",
          material: "metal",
        }),
      ]),
    ],
  },
};

/* --------------------------- Générique ---------------------------- */

export const DESK_ORGANIZER: Design = {
  title: "Organiseur de bureau modulaire",
  category: "Rangement",
  difficulty: "facile",
  analysis: {
    summary:
      "Les petits objets du bureau (stylos, cartes, téléphone) n'ont pas de place attitrée. Il faut un organiseur compact qui regroupe tout.",
    needs: ["Ranger les stylos debout", "Un vide-poche", "Un emplacement pour le téléphone"],
    constraints: ["Emprise réduite", "Nettoyage facile", "Imprimable en une fois"],
    assumptions: ["Bureau standard", "Stylos de 15 cm maximum"],
  },
  solution: {
    concept: "Un plateau arrondi qui accueille un pot à crayons, un bac et une fente pour téléphone.",
    howItWorks: "Chaque module est solidaire du plateau : on pose l'ensemble à côté de l'écran et chaque objet retrouve sa place.",
    keyFeatures: ["Pot à crayons Ø 70", "Bac à petits objets", "Fente téléphone", "Angles arrondis"],
  },
  dimensions: { width: 220, depth: 120, height: 100, weightGrams: 210, notes: "" },
  materials: [{ name: "PLA", usage: "Ensemble", quantity: "≈ 200 g", color: "#5b6ee1" }],
  fabrication: [
    { title: "Imprimer", detail: "Remplissage 15 %, 3 périmètres.", tool: "Imprimante 3D FDM", durationMin: 300 },
    { title: "Finition", detail: "Retirer les filaments résiduels, poncer les bords.", tool: "Cutter, papier abrasif", durationMin: 15 },
  ],
  cost: { currency: "EUR", min: 4, max: 7, items: [{ label: "Filament PLA (200 g)", amount: 4.4 }], notes: "" },
  recommendations: ["Ajouter des pastilles antidérapantes sous le plateau."],
  model: {
    parts: [
      part("plateau", "Plateau", "Base commune des modules", "box", [220, 8, 120], [0, 4, 0], { cornerRadius: 10, color: "#5b6ee1" }),
      part("pot", "Pot à crayons", "Range les stylos debout", "tube", [70, 92, 3], [-65, 54, -10], { color: "#7b5ce6" }),
      part("bac", "Bac", "Vide-poche", "box", [80, 30, 70], [30, 23, -15], { cornerRadius: 6, color: "#8f7cf0" }),
      part("fente-1", "Joue avant", "Retient le téléphone", "box", [100, 26, 6], [40, 21, 42], { cornerRadius: 2, color: "#ff6fb5" }),
      part("fente-2", "Joue arrière", "Dossier du téléphone", "box", [100, 46, 6], [40, 31, 26], {
        rotation: [-12, 0, 0],
        cornerRadius: 2,
        color: "#ff6fb5",
      }),
    ],
  },
};

export const SAMPLE_DESIGNS: { id: string; prompt: string; design: Design; daysAgo: number }[] = [
  { id: "exemple-telephone", prompt: "Un support de téléphone pour mon bureau, qui laisse passer le câble.", design: PHONE_STAND, daysAgo: 0 },
  { id: "exemple-cables", prompt: "Une solution pour ranger mes câbles de charge qui tombent derrière le bureau.", design: CABLE_ORGANIZER, daysAgo: 1 },
  { id: "exemple-entree", prompt: "Je perds tout le temps mes clés en rentrant chez moi.", design: WALL_KEY_SHELF, daysAgo: 3 },
  { id: "exemple-bureau", prompt: "Un organiseur pour mon bureau : stylos, cartes, téléphone.", design: DESK_ORGANIZER, daysAgo: 5 },
];
