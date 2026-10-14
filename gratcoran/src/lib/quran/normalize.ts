/**
 * Normalisation de texte arabe pour la comparaison (jamais pour l'affichage).
 *
 * Le texte coranique affiché reste toujours celui du paquet `quran-json`, intact.
 * Cette forme « squelette » sert uniquement à rapprocher une transcription
 * (écriture courante, sans voyelles) du rasm uthmani :
 * - suppression des voyelles, signes de lecture et marques de pause ;
 * - unification des lettres (hamza, alif maqsura, ta marbuta, variantes persanes) ;
 * - suppression des alifs (l'orthographe uthmanie omet souvent l'alif long
 *   que l'écriture courante écrit : ٱلۡعَٰلَمِينَ ↔ العالمين) ;
 * - suppression des espaces (يٰٓأَيُّهَا ↔ يا أيها).
 */

const ALPHABET = "بتثجحخدذرزسشصضطظعغفقكلمنهوي";

/** Index (1..27) de chaque lettre de l'alphabet normalisé, 0 sinon. */
const LETTER_CODE = new Map<string, number>(
  [...ALPHABET].map((letter, i) => [letter, i + 1]),
);

export const ALPHABET_SIZE = ALPHABET.length + 1;

const LETTER_MAP: Record<string, string> = {
  "ة": "ه",
  "ى": "ي",
  "ئ": "ي",
  "ؤ": "و",
  "ک": "ك",
  "ی": "ي",
  "ہ": "ه",
  "ۀ": "ه",
  "ھ": "ه",
};

/** Un waw portant directement un alif suscrit se lit « a » (صلوٰة → صلاة). */
const WAW_AS_ALIF = /\u0648\u0670/g;

/** Voyelles, tanwin, chadda, soukoun, signes coraniques, tatwil. */
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g;

/** Alifs (toutes formes) et hamza isolée : supprimés des deux côtés. */
const ALIFS = /[\u0621\u0622\u0623\u0625\u0627\u0671\u0672\u0673]/g;

/**
 * Normalise un texte arabe en suite de lettres comparables.
 * Retourne une chaîne ne contenant que des lettres de `ALPHABET`.
 */
export function normalizeArabic(input: string): string {
  let text = input.normalize("NFC").replace(WAW_AS_ALIF, "");
  text = text.replace(MARKS, "").replace(ALIFS, "");
  let out = "";
  for (const ch of text) {
    const mapped = LETTER_MAP[ch] ?? ch;
    if (LETTER_CODE.has(mapped)) out += mapped;
  }
  return out;
}

/** Codes de trigrammes (uniques, triés) d'une chaîne normalisée. */
export function trigramCodes(normalized: string): Int32Array {
  const codes = new Set<number>();
  const letters = [...normalized].map((c) => LETTER_CODE.get(c) ?? 0);
  for (let i = 0; i + 2 < letters.length; i++) {
    codes.add(
      (letters[i] * ALPHABET_SIZE + letters[i + 1]) * ALPHABET_SIZE +
        letters[i + 2],
    );
  }
  return Int32Array.from([...codes].sort((a, b) => a - b));
}

const ISTIADHA = normalizeArabic("أعوذ بالله من الشيطان الرجيم");
const BASMALA = normalizeArabic("بسم الله الرحمن الرحيم");

export type PreparedQuery = {
  /** Texte normalisé utilisé pour la recherche. */
  normalized: string;
  /** Vrai si la requête ne contient guère plus que la basmala. */
  basmalaOnly: boolean;
};

/**
 * Prépare une transcription : retire l'isti'adha et la basmala d'ouverture,
 * récitées en tête de presque toutes les sourates (sauf si la requête
 * ne contient rien d'autre).
 */
export function prepareQuery(transcript: string): PreparedQuery {
  let normalized = normalizeArabic(transcript);
  const strip = (prefix: string) => {
    const at = normalized.indexOf(prefix);
    if (at >= 0 && at <= 4) normalized = normalized.slice(at + prefix.length);
  };
  strip(ISTIADHA);
  const beforeBasmala = normalized;
  strip(BASMALA);
  if (normalized.length < 8 && beforeBasmala !== normalized) {
    return { normalized: beforeBasmala, basmalaOnly: true };
  }
  return { normalized, basmalaOnly: false };
}
