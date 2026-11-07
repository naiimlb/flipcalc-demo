/** Types des données coraniques générées par `scripts/fetch-quran.mjs`. */

export interface Ayah {
  /** Numéro dans la sourate (1…). */
  n: number;
  /** Numéro global (1…6236). */
  g: number;
  /** Texte arabe, rasm uthmani, tel que fourni par la source. */
  ar: string;
  /** Traduction française (Hamidullah). */
  fr: string;
  juz: number;
  page: number;
  sajda?: boolean;
}

export interface SurahData {
  number: number;
  /** Afficher la basmala au-dessus de la sourate (toutes sauf 1 et 9). */
  basmala: boolean;
  ayahs: Ayah[];
}

export interface SurahMeta {
  number: number;
  nameAr: string;
  transliteration: string;
  revelation: "meccan" | "medinan";
  ayahCount: number;
  firstAyah: number;
  sha256: string;
  bytes: number;
}

export interface Reciter {
  /** Dossier EveryAyah. */
  id: string;
  name: string;
  style: "murattal" | "enseignement";
  bitrate: string;
}

export interface QuranIndex {
  schema: 1;
  fetchedAt: string;
  sources: {
    text: { provider: string; edition: string; url: string; origin: string };
    translation: { provider: string; edition: string; url: string; author: string };
    audio: { provider: string; url: string };
  };
  totals: { surahs: number; ayahs: number };
  basmala: string;
  defaultReciter: string;
  reciters: Reciter[];
  surahs: SurahMeta[];
}

/** Clé d'un verset : « sourate:verset », par ex. « 2:255 ». */
export type VerseKey = `${number}:${number}`;
