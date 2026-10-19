/**
 * Détecteur de règles de tajweed à partir du texte uthmani voyellé de `quran-json`.
 *
 * Ce texte suit les conventions d'écriture du mushaf de Médine (KFGQPC) : les règles
 * y sont inscrites dans les signes eux-mêmes, que l'on lit ici sans jamais modifier le texte.
 * - noun avec soukoun « ۡ » → idhhar ; noun sans signe → ikhfa ou idgham ;
 * - tanwin habituel (ً ٌ ٍ) → idhhar ; tanwin « décalé » (ٞ ٗ ٖ) → ikhfa ou idgham ;
 * - petit mim (ۢ ۭ) → iqlab ; maddah (ٓ) → madd long ; chadda sur noun/mim → ghunna.
 */

export type RuleFamily =
  | "noon"
  | "mim"
  | "ghunna"
  | "madd"
  | "qalqala"
  | "lam"
  | "tafkhim"
  | "waqf"
  | "makharij";

export type RuleId =
  | "idhhar"
  | "idgham_ghunna"
  | "idgham_sans_ghunna"
  | "iqlab"
  | "ikhfa"
  | "idhhar_shafawi"
  | "idgham_shafawi"
  | "ikhfa_shafawi"
  | "ghunna"
  | "madd_lazim"
  | "madd_muttasil"
  | "madd_munfasil"
  | "madd_arid"
  | "qalqala"
  | "lam_shamsiyya"
  | "lam_qamariyya"
  | "lafdh_jalala"
  | "tafkhim"
  | "ra"
  | "waqf"
  | "makharij";

export type Rule = {
  id: RuleId;
  family: RuleFamily;
  nameAr: string;
  nameFr: string;
  /**
   * Règle « subtile » : durée, nasalisation, rebond ou timbre. L'IA ne peut pas la juger :
   * elle n'est jamais présentée comme une faute, seulement comme un point d'attention.
   */
  subtle: boolean;
  lesson: string;
  tip: string;
};

export const FAMILY_COLORS: Record<RuleFamily, string> = {
  noon: "#0284c7",
  mim: "#7c3aed",
  ghunna: "#db2777",
  madd: "#d97706",
  qalqala: "#0d9488",
  lam: "#65a30d",
  tafkhim: "#9a3412",
  waqf: "#475569",
  makharij: "#2563eb",
};

export const RULES: Record<RuleId, Rule> = {
  idhhar: {
    id: "idhhar",
    family: "noon",
    nameAr: "إظهار",
    nameFr: "Idhhar (prononciation claire)",
    subtle: false,
    lesson:
      "Quand un noun sakin ou un tanwin est suivi d'une lettre de la gorge (ء ه ع ح غ خ), le « n » se prononce nettement, sans nasaliser ni prolonger.",
    tip: "Dis le « n » franchement puis enchaîne directement sur la lettre suivante.",
  },
  idgham_ghunna: {
    id: "idgham_ghunna",
    family: "noon",
    nameAr: "إدغام بغنة",
    nameFr: "Idgham avec ghunna (fusion nasalisée)",
    subtle: true,
    lesson:
      "Un noun sakin ou un tanwin suivi de ي ن م و se fond dans cette lettre, en gardant une nasalisation d'environ deux temps.",
    tip: "Ne prononce pas le « n » : passe directement à la lettre suivante en gardant le son dans le nez.",
  },
  idgham_sans_ghunna: {
    id: "idgham_sans_ghunna",
    family: "noon",
    nameAr: "إدغام بغير غنة",
    nameFr: "Idgham sans ghunna (fusion complète)",
    subtle: false,
    lesson: "Un noun sakin ou un tanwin suivi de ل ou ر disparaît complètement dans cette lettre, sans nasalisation.",
    tip: "Saute le « n » et appuie directement la lettre ل ou ر (elle porte une chadda).",
  },
  iqlab: {
    id: "iqlab",
    family: "noon",
    nameAr: "إقلاب",
    nameFr: "Iqlab (transformation en mim)",
    subtle: true,
    lesson:
      "Devant la lettre ب, le noun sakin ou le tanwin se transforme en un mim discret, avec nasalisation. Le petit mim (ۢ) du mushaf le signale.",
    tip: "Rapproche doucement les lèvres comme pour un « m », garde la nasalisation, puis prononce le ب.",
  },
  ikhfa: {
    id: "ikhfa",
    family: "noon",
    nameAr: "إخفاء",
    nameFr: "Ikhfa (dissimulation nasalisée)",
    subtle: true,
    lesson:
      "Devant 15 lettres (ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك), le noun sakin ou le tanwin est « caché » : ni prononcé clairement, ni fusionné, avec une nasalisation d'environ deux temps.",
    tip: "Ne colle pas la langue pour faire le « n » : prépare déjà la lettre suivante en laissant le son passer par le nez.",
  },
  idhhar_shafawi: {
    id: "idhhar_shafawi",
    family: "mim",
    nameAr: "إظهار شفوي",
    nameFr: "Idhhar shafawi (mim clair)",
    subtle: false,
    lesson: "Un mim sakin suivi d'une lettre autre que ب ou م se prononce clairement, sans nasalisation prolongée.",
    tip: "Ferme les lèvres pour le « m » puis enchaîne sans le prolonger, surtout devant و et ف.",
  },
  idgham_shafawi: {
    id: "idgham_shafawi",
    family: "mim",
    nameAr: "إدغام شفوي",
    nameFr: "Idgham shafawi (fusion de deux mim)",
    subtle: true,
    lesson: "Un mim sakin suivi d'un autre mim se fond en un seul mim appuyé, avec une ghunna d'environ deux temps.",
    tip: "Garde les lèvres fermées sur un seul « m » prolongé et nasalisé.",
  },
  ikhfa_shafawi: {
    id: "ikhfa_shafawi",
    family: "mim",
    nameAr: "إخفاء شفوي",
    nameFr: "Ikhfa shafawi (mim dissimulé)",
    subtle: true,
    lesson: "Un mim sakin suivi de ب est légèrement caché, avec nasalisation, avant de prononcer le ب.",
    tip: "Effleure les lèvres sans les serrer fort, laisse la nasalisation, puis prononce le ب.",
  },
  ghunna: {
    id: "ghunna",
    family: "ghunna",
    nameAr: "غنة",
    nameFr: "Ghunna (nasalisation)",
    subtle: true,
    lesson: "Un noun ou un mim portant une chadda (نّ مّ) se prononce avec une nasalisation d'environ deux temps.",
    tip: "Tiens le son dans le nez le temps de deux battements avant d'enchaîner.",
  },
  madd_lazim: {
    id: "madd_lazim",
    family: "madd",
    nameAr: "مد لازم",
    nameFr: "Madd lazim (allongement de 6 temps)",
    subtle: true,
    lesson:
      "Quand une lettre d'allongement est suivie d'une lettre sakina ou doublée (chadda), ou dans certaines lettres isolées en début de sourate (الٓمٓ), l'allongement est obligatoire : 6 temps.",
    tip: "Compte mentalement six battements réguliers sur la voyelle longue.",
  },
  madd_muttasil: {
    id: "madd_muttasil",
    family: "madd",
    nameAr: "مد متصل",
    nameFr: "Madd muttasil (allongement lié)",
    subtle: true,
    lesson:
      "Une lettre d'allongement suivie d'une hamza dans le même mot s'allonge obligatoirement de 4 ou 5 temps (lecture Hafs).",
    tip: "Allonge nettement (4 ou 5 temps) avant la hamza, et garde la même durée partout dans ta récitation.",
  },
  madd_munfasil: {
    id: "madd_munfasil",
    family: "madd",
    nameAr: "مد منفصل",
    nameFr: "Madd munfasil (allongement séparé)",
    subtle: true,
    lesson:
      "Une lettre d'allongement en fin de mot suivie d'une hamza au début du mot suivant s'allonge de 4 ou 5 temps (lecture Hafs).",
    tip: "Allonge la fin du mot avant d'attaquer la hamza du mot suivant, avec une durée constante.",
  },
  madd_arid: {
    id: "madd_arid",
    family: "madd",
    nameAr: "مد عارض للسكون",
    nameFr: "Madd 'arid (allongement à l'arrêt)",
    subtle: true,
    lesson:
      "Quand on s'arrête sur un mot dont l'avant-dernière lettre est une lettre d'allongement, on peut allonger de 2, 4 ou 6 temps.",
    tip: "Choisis une durée (2, 4 ou 6 temps) et garde-la pour tous les arrêts de ta récitation.",
  },
  qalqala: {
    id: "qalqala",
    family: "qalqala",
    nameAr: "قلقلة",
    nameFr: "Qalqala (rebond)",
    subtle: true,
    lesson:
      "Les lettres ق ط ب ج د portant un soukoun (ou à l'arrêt en fin de verset) produisent un léger rebond sonore.",
    tip: "Fais un petit écho bref sur la lettre, sans ajouter de voyelle ni d'« e » à la fin.",
  },
  lam_shamsiyya: {
    id: "lam_shamsiyya",
    family: "lam",
    nameAr: "لام شمسية",
    nameFr: "Lam shamsiyya (lam muet)",
    subtle: false,
    lesson: "Devant une lettre « solaire », le lam de l'article ال ne se prononce pas : la lettre suivante est doublée.",
    tip: "Saute le lam et appuie la lettre suivante (elle porte une chadda).",
  },
  lam_qamariyya: {
    id: "lam_qamariyya",
    family: "lam",
    nameAr: "لام قمرية",
    nameFr: "Lam qamariyya (lam prononcé)",
    subtle: false,
    lesson: "Devant une lettre « lunaire », le lam de l'article ال se prononce clairement (il porte un soukoun).",
    tip: "Fais bien entendre le « l » avant la lettre suivante.",
  },
  lafdh_jalala: {
    id: "lafdh_jalala",
    family: "lam",
    nameAr: "لفظ الجلالة",
    nameFr: "Le nom « Allah »",
    subtle: true,
    lesson:
      "Le lam du nom « Allah » est épais (tafkhim) après un a ou un ou, et fin (tarqiq) après un i.",
    tip: "Après un « i » (comme dans بِسۡمِ ٱللَّهِ), garde le lam léger ; sinon, arrondis-le et épaissis-le.",
  },
  tafkhim: {
    id: "tafkhim",
    family: "tafkhim",
    nameAr: "تفخيم",
    nameFr: "Tafkhim (lettres épaisses)",
    subtle: true,
    lesson: "Les lettres خ ص ض غ ط ق ظ se prononcent toujours épaisses, la langue relevée vers le palais.",
    tip: "Relève l'arrière de la langue et arrondis un peu la bouche sur ces lettres.",
  },
  ra: {
    id: "ra",
    family: "tafkhim",
    nameAr: "الراء",
    nameFr: "La lettre ر (épaisse ou fine)",
    subtle: true,
    lesson: "Le ر est épais avec une fatha ou une damma, fin avec une kasra ; s'il est sakin, il suit la voyelle précédente.",
    tip: "Écoute la voyelle du ر : « a » ou « ou » → son plein ; « i » → son léger.",
  },
  waqf: {
    id: "waqf",
    family: "waqf",
    nameAr: "الوقف",
    nameFr: "Signe de pause (waqf)",
    subtle: false,
    lesson:
      "Les petits signes au-dessus du texte indiquent où l'on peut s'arrêter : ۘ arrêt nécessaire, ۗ arrêt préférable, ۚ arrêt permis, ۖ continuer préférable, ۛ s'arrêter à l'un des deux seulement.",
    tip: "Repère ces signes avant de réciter et reprends ton souffle aux endroits indiqués.",
  },
  makharij: {
    id: "makharij",
    family: "makharij",
    nameAr: "مخارج الحروف",
    nameFr: "Points de sortie des lettres (makharij)",
    subtle: false,
    lesson: "Chaque lettre arabe a son point d'articulation précis ; confondre deux lettres proches change le mot.",
    tip: "Prononce lentement la lettre seule, puis dans le mot, en exagérant légèrement son point de sortie.",
  },
};

/** Conseils précis pour les confusions de lettres les plus fréquentes. */
export const CONFUSION_TIPS: Record<string, string> = {
  "حه": "ح vient du milieu de la gorge (souffle serré, sans vibration) ; ه est un simple souffle léger du fond de la gorge.",
  "عء": "ع se forme en serrant le milieu de la gorge avec voix ; ء est un coup de glotte bref.",
  "قك": "ق se prononce tout au fond de la bouche, épais ; ك est plus en avant et léger.",
  "صس": "ص est épais (langue relevée) ; س est fin.",
  "طت": "ط est épais et appuyé ; ت est fin et léger.",
  "ضد": "ض sort des bords de la langue contre les molaires, épais ; د est fin, du bout de la langue.",
  "ظذ": "ظ est un ذ épais : bout de la langue entre les dents, arrière de la langue relevé.",
  "ذز": "ذ se prononce le bout de la langue entre les dents ; ز derrière les dents, comme un « z ».",
  "ثس": "ث se prononce le bout de la langue entre les dents ; س derrière les dents, comme un « s ».",
  "خح": "خ est un raclement du fond de la bouche ; ح un souffle serré du milieu de la gorge.",
  "غع": "غ est un raclement vibrant du fond de la bouche ; ع vient de la gorge.",
  "ظض": "ظ se prononce entre les dents ; ض avec les bords de la langue contre les molaires.",
};

export function confusionTip(expected: string, heard: string): string | null {
  return CONFUSION_TIPS[expected + heard] ?? CONFUSION_TIPS[heard + expected] ?? null;
}

// --- Analyse du texte voyellé -------------------------------------------------

const SUKUN = /[ْۡ]/;
const SHADDA = "ّ";
const FATHA = "َ";
const DAMMA = "ُ";
const KASRA = "ِ";
const TANWIN_CLEAR = /[ًٌٍ]/;
const TANWIN_OPEN = /[ࣰࣱࣲٖٞٗ]/;
const TANWIN_KASR = /[ٍࣲٖ]/;
const IQLAB = /[ۭۢ]/;
const MADDAH = "ٓ";
const HAMZA_ABOVE = "ٔ";
const COMBINING = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/;
const WAQF_MARKS: Record<string, string> = {
  "ۘ": "arrêt nécessaire (م)",
  "ۗ": "arrêt préférable (قلى)",
  "ۚ": "arrêt permis (ج)",
  "ۖ": "continuer est préférable (صلى)",
  "ۛ": "arrêt sur l'un des deux signes (∴)",
  "ۙ": "ne pas s'arrêter (لا)",
};

const THROAT = new Set([..."ءأإؤئهعحغخ"]);
const IDGHAM_GHUNNA = new Set([..."ينمو"]);
const IDGHAM_SANS = new Set([..."لر"]);
const QALQALA = new Set([..."قطبجد"]);
const TAFKHIM = new Set([..."خصضغطقظ"]);
const HAMZAS = new Set([..."ءأإؤئ"]);
const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

type Unit = { ch: string; marks: string };

/** Découpe un mot en lettres + signes qui les suivent (le tatwil sert de support). */
export function units(word: string): Unit[] {
  const out: Unit[] = [];
  for (const ch of word) {
    if (COMBINING.test(ch) && out.length) out[out.length - 1].marks += ch;
    else out.push({ ch, marks: "" });
  }
  return out;
}

const isLetter = (u: Unit | undefined) => !!u && ARABIC_LETTER.test(u.ch);
const vowelOf = (u: Unit) =>
  u.marks.includes(KASRA) || TANWIN_KASR.test(u.marks)
    ? "i"
    : u.marks.includes(DAMMA) || /[ٌٗ]/.test(u.marks)
      ? "u"
      : u.marks.includes(FATHA) || /[ًٞ]/.test(u.marks)
        ? "a"
        : null;
const isBare = (u: Unit) => u.marks === "";
/** Alif, alif maqsura ou waw/ya muets servant de support (rien à prononcer). */
const isSilentSupport = (u: Unit) => (u.ch === "ا" || u.ch === "ى") && !u.marks.replace(/[۟۠]/g, "");

const ALLAH_PREFIX = new Set([..."ٱوفبتأ"]);

/** Vrai pour le nom « Allah », éventuellement précédé d'une particule (و ف ب ت) ou suivi de م. */
function isAllahWord(us: Unit[]): boolean {
  for (let i = 0; i + 2 < us.length; i++) {
    if (us[i].ch !== "ل" || us[i + 1].ch !== "ل" || us[i + 2].ch !== "ه") continue;
    if (!us[i + 1].marks.includes(SHADDA)) continue;
    const prefixOk = us.slice(0, i).every((u) => ALLAH_PREFIX.has(u.ch) || u.ch === "ل");
    const suffixOk = us.slice(i + 3).every((u) => u.ch === "م");
    return prefixOk && suffixOk && i <= 3;
  }
  return false;
}

export type WordToken = {
  /** Texte exact du mot, tel qu'il apparaît dans le mushaf. */
  text: string;
  verse: number;
  /** Indice du mot dans le verset (0-based). */
  indexInVerse: number;
  rules: RuleId[];
  /** Signe de pause porté par le mot, le cas échéant. */
  waqf?: string;
};

/** Mots d'un verset (les signes isolés comme ۞ restent attachés au mot voisin). */
export function tokenizeVerse(text: string, verse: number): WordToken[] {
  const raw = text.split(/\s+/).filter(Boolean);
  const words: WordToken[] = [];
  let pendingPrefix = "";
  for (const part of raw) {
    if (!ARABIC_LETTER.test(part)) {
      if (words.length) words[words.length - 1].text += ` ${part}`;
      else pendingPrefix += `${part} `;
      continue;
    }
    words.push({ text: pendingPrefix + part, verse, indexInVerse: words.length, rules: [] });
    pendingPrefix = "";
  }
  return words;
}

/** Attribue les règles de tajweed à chaque mot d'une suite de mots lus d'un trait. */
export function annotate(words: WordToken[], verseEnds: Set<number>): WordToken[] {
  const parsed = words.map((w) => units(w.text).filter((u) => isLetter(u) || u.ch === "ـ"));

  /** Prochaine lettre prononcée après la position (w, k), en sautant les supports muets. */
  const next = (w: number, k: number): { unit: Unit; sameWord: boolean } | null => {
    for (let k2 = k + 1; k2 < parsed[w].length; k2++) {
      const u = parsed[w][k2];
      if (u.ch === "ـ" || isSilentSupport(u)) continue;
      return { unit: u, sameWord: true };
    }
    if (verseEnds.has(w) || w + 1 >= parsed.length) return null;
    const first = parsed[w + 1][0];
    return first ? { unit: first, sameWord: false } : null;
  };

  return words.map((word, w) => {
    const rules = new Set<RuleId>();
    const us = parsed[w];
    let waqf: string | undefined;
    for (const ch of word.text) if (WAQF_MARKS[ch]) waqf = WAQF_MARKS[ch];
    if (waqf) rules.add("waqf");

    for (let k = 0; k < us.length; k++) {
      const u = us[k];
      const nx = next(w, k);
      const nextCh = nx?.unit.ch;

      // Noun sakin et tanwin.
      const tanwinClear = TANWIN_CLEAR.test(u.marks);
      const tanwinOpen = TANWIN_OPEN.test(u.marks);
      const noonSakin = u.ch === "ن" && (SUKUN.test(u.marks) || isBare(u));
      if (IQLAB.test(u.marks)) rules.add("iqlab");
      else if (nx && nextCh !== "ٱ" && (noonSakin || tanwinClear || tanwinOpen)) {
        const clear = (u.ch === "ن" && SUKUN.test(u.marks)) || tanwinClear;
        if (clear) {
          if (THROAT.has(nextCh!)) rules.add("idhhar");
        } else if (IDGHAM_GHUNNA.has(nextCh!)) rules.add("idgham_ghunna");
        else if (IDGHAM_SANS.has(nextCh!)) rules.add("idgham_sans_ghunna");
        else if (nextCh === "ب") rules.add("iqlab");
        else if (!THROAT.has(nextCh!)) rules.add("ikhfa");
      }

      // Mim sakin.
      if (u.ch === "م" && nx && !nx.sameWord) {
        if (isBare(u) && nextCh === "ب") rules.add("ikhfa_shafawi");
        else if (isBare(u) && nextCh === "م") rules.add("idgham_shafawi");
        else if (SUKUN.test(u.marks) && nextCh !== "ٱ") rules.add("idhhar_shafawi");
      }

      // Ghunna (noun / mim doublés).
      if ((u.ch === "ن" || u.ch === "م") && u.marks.includes(SHADDA)) rules.add("ghunna");

      // Madd long signalé par la maddah.
      // Une maddah posée sur une hamza (آ) est un simple madd badal de deux temps,
      // sauf si une lettre sakina ou doublée suit (ex. ءَآلۡـَٰٔنَ).
      const badal =
        HAMZAS.has(u.ch) && !(nx?.sameWord && (SUKUN.test(nx.unit.marks) || nx.unit.marks.includes(SHADDA)));
      if (u.marks.includes(MADDAH) && !badal) {
        if (!nx) rules.add("madd_lazim");
        else if (nx.sameWord) {
          if (HAMZAS.has(nx.unit.ch) || nx.unit.marks.includes(HAMZA_ABOVE)) rules.add("madd_muttasil");
          else rules.add("madd_lazim");
        } else if (HAMZAS.has(nx.unit.ch)) rules.add("madd_munfasil");
        else rules.add("madd_lazim");
      }

      // Qalqala.
      if (QALQALA.has(u.ch) && SUKUN.test(u.marks)) rules.add("qalqala");

      // Lettres épaisses et ر.
      if (TAFKHIM.has(u.ch)) rules.add("tafkhim");
      if (u.ch === "ر") rules.add("ra");

      // Article ال : lam solaire ou lunaire.
      if (u.ch === "ٱ" && us[k + 1]?.ch === "ل") {
        const lam = us[k + 1];
        const after = us[k + 2];
        const isAllah = after?.ch === "ل" && us[k + 3]?.ch === "ه";
        if (!isAllah) {
          if (SUKUN.test(lam.marks)) rules.add("lam_qamariyya");
          else if (isBare(lam) && after?.marks.includes(SHADDA)) rules.add("lam_shamsiyya");
        }
      }
    }

    // Nom « Allah » (ٱللَّه, لِلَّه, بِٱللَّه, وَٱللَّهُ, ٱللَّهُمَّ…).
    if (isAllahWord(us)) rules.add("lafdh_jalala");

    // Fin de verset : qalqala à l'arrêt et madd 'arid.
    if (verseEnds.has(w) && us.length >= 2) {
      const last = us[us.length - 1];
      if (QALQALA.has(last.ch)) rules.add("qalqala");
      const before = us[us.length - 2];
      const prev = us[us.length - 3];
      const madd =
        (before.ch === "ا" && !vowelOf(before)) ||
        (before.ch === "و" && (isBare(before) || SUKUN.test(before.marks)) && prev && vowelOf(prev) === "u") ||
        (before.ch === "ي" && (isBare(before) || SUKUN.test(before.marks)) && prev && vowelOf(prev) === "i") ||
        before.marks.includes("ٰ");
      if (madd) rules.add("madd_arid");
    }

    return { ...word, rules: [...rules], waqf };
  });
}

/** Règles présentes dans un passage, dans un ordre pédagogique stable. */
export function rulesInPassage(words: WordToken[]): RuleId[] {
  const order = Object.keys(RULES) as RuleId[];
  const present = new Set(words.flatMap((w) => w.rules));
  return order.filter((id) => present.has(id));
}
