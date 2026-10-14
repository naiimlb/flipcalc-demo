import type { Confidence, MatchResult, SourceSurah } from "./matcher";

export type SurahInfo = {
  number: number;
  nameArabic: string;
  nameFrench: string;
  transliteration: string;
  totalVerses: number;
};

export type VerseInfo = { number: number; text: string; translation: string };

export type Recognition = {
  confidence: Confidence;
  lowReason: MatchResult["lowReason"] | null;
  /** Sourate la plus probable (simple piste si la confiance est faible). */
  surah: SurahInfo | null;
  /** Vrai si la sourate est longue : le verset est alors affiché. */
  showVerse: boolean;
  verseStart: number | null;
  verseEnd: number | null;
  /** Versets affichés (texte original intact + traduction), sourates longues seulement. */
  verses: VerseInfo[];
  /** Autres versets possibles dans la même sourate (versets répétés). */
  otherVerses: number[];
  /** Autres sourates possibles quand la marge est faible. */
  otherSurahs: SurahInfo[];
  score: number;
};

export function surahInfo(s: SourceSurah): SurahInfo {
  return {
    number: s.id,
    nameArabic: s.name,
    nameFrench: s.translation,
    transliteration: s.transliteration,
    totalVerses: s.total_verses,
  };
}

export function versesOf(s: SourceSurah, start: number, end: number): VerseInfo[] {
  return s.verses
    .filter((v) => v.id >= start && v.id <= end)
    .map((v) => ({ number: v.id, text: v.text, translation: v.translation }));
}

/** Transforme un résultat de matching en réponse affichable. */
export function present(
  result: MatchResult,
  surahs: readonly SourceSurah[],
): Recognition {
  const best = result.best;
  if (!best) {
    return {
      confidence: "low",
      lowReason: result.lowReason ?? "empty",
      surah: null,
      showVerse: false,
      verseStart: null,
      verseEnd: null,
      verses: [],
      otherVerses: [],
      otherSurahs: [],
      score: 0,
    };
  }
  const surah = surahs[best.surah - 1];
  const showVerse = result.isLongSurah && result.confidence !== "low";
  const closeOthers = result.otherSurahs.filter(
    (o) => best.score - o.score < 0.12,
  );
  return {
    confidence: result.confidence,
    lowReason: result.lowReason ?? null,
    surah: surahInfo(surah),
    showVerse,
    verseStart: best.verseStart,
    verseEnd: best.verseEnd,
    verses: showVerse ? versesOf(surah, best.verseStart, best.verseEnd) : [],
    otherVerses: showVerse ? result.sameSurahAlternatives : [],
    otherSurahs: closeOthers.map((o) => surahInfo(surahs[o.surah - 1])),
    score: Math.round(best.score * 1000) / 1000,
  };
}
