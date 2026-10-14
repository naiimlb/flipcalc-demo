import type { SourceSurah } from "../../src/lib/quran/matcher";

/** PRNG déterministe (mulberry32) pour des tests reproductibles. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS = [..."ابتثجحخدذرزسشصضطظعغفقكلمنهوي"];
const MARKS = /[ً-ٟۖ-ۭـ]/g;

/**
 * Approximation d'une transcription Whisper : écriture courante sans voyelles
 * (alif suscrit → alif, alif wasla → alif), à partir du texte uthmani.
 */
export function toPlainArabic(uthmani: string): string {
  return uthmani
    .replace(/ٰ/g, "ا")
    .replace(/ٱ/g, "ا")
    .replace(MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type Extract = {
  surah: number;
  /** Versets (inclus) couverts par l'extrait. */
  verseStart: number;
  verseEnd: number;
  text: string;
};

export type NoiseOptions = {
  minWords: number;
  maxWords: number;
  /** Probabilité de supprimer un mot. */
  dropWord: number;
  /** Probabilité de remplacer une lettre par une autre. */
  wrongLetter: number;
};

export const DEFAULT_NOISE: NoiseOptions = {
  minWords: 6,
  maxWords: 20,
  dropWord: 0.1,
  wrongLetter: 0.05,
};

/** Tire un extrait aléatoire (pouvant chevaucher plusieurs versets) et le bruite. */
export function noisyExtract(
  surahs: SourceSurah[],
  random: () => number,
  noise: NoiseOptions = DEFAULT_NOISE,
): Extract {
  const surah = surahs[Math.floor(random() * surahs.length)];
  const words: { word: string; verse: number }[] = [];
  for (const v of surah.verses) {
    for (const w of toPlainArabic(v.text).split(" ")) {
      if (w) words.push({ word: w, verse: v.id });
    }
  }
  const span =
    noise.minWords + Math.floor(random() * (noise.maxWords - noise.minWords + 1));
  const length = Math.min(span, words.length);
  const start = Math.floor(random() * (words.length - length + 1));
  const slice = words.slice(start, start + length);

  const kept = slice.filter(() => random() >= noise.dropWord);
  const text = (kept.length ? kept : slice)
    .map(({ word }) =>
      [...word]
        .map((ch) =>
          random() < noise.wrongLetter
            ? LETTERS[Math.floor(random() * LETTERS.length)]
            : ch,
        )
        .join(""),
    )
    .join(" ");

  return {
    surah: surah.id,
    verseStart: slice[0].verse,
    verseEnd: slice[slice.length - 1].verse,
    text,
  };
}
