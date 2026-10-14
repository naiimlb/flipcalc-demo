import { normalizeArabic, prepareQuery, trigramCodes } from "./normalize";

export type SourceVerse = { id: number; text: string; translation: string };
export type SourceSurah = {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  total_verses: number;
  verses: SourceVerse[];
};

export type Confidence = "high" | "medium" | "low";

export type MatcherOptions = {
  /** Sourates de moins de `longSurahThreshold` versets : on n'affiche que la sourate. */
  longSurahThreshold: number;
  /** Nombre maximal de versets consécutifs par fenêtre. */
  maxWindow: number;
};

export const DEFAULT_OPTIONS: MatcherOptions = {
  longSurahThreshold: 20,
  maxWindow: 3,
};

export type WindowScore = {
  surah: number;
  verseStart: number;
  verseEnd: number;
  score: number;
  coverage: number;
  dice: number;
};

export type MatchResult = {
  /** Meilleure fenêtre trouvée (null si la requête est vide ou trop courte). */
  best: WindowScore | null;
  confidence: Confidence;
  /** Vrai si la sourate a ≥ seuil versets : le verset est alors affiché. */
  isLongSurah: boolean;
  /**
   * Autres versets de la même sourate au texte (quasi) identique,
   * ex. « فَبِأَيِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ » dans Ar-Rahman.
   */
  sameSurahAlternatives: number[];
  /** Meilleures pistes dans d'autres sourates (score décroissant). */
  otherSurahs: WindowScore[];
  /** Raison d'une confiance faible, pour adapter le message. */
  lowReason?: "empty" | "short" | "basmala" | "ambiguous" | "weak";
  queryLength: number;
};

type IndexedVerse = {
  surah: number;
  ayah: number;
  /** Position dans la sourate (0-based) et index global du premier verset. */
  globalIndex: number;
  normalized: string;
  trigrams: Int32Array;
  set: Set<number>;
};

/** Seuils de confiance (calibrés par les tests de bruit). */
const HIGH_SCORE = 0.6;
const HIGH_MARGIN = 0.12;
const MEDIUM_SCORE = 0.45;
const MEDIUM_MARGIN = 0.06;
/** En dessous de ce nombre de trigrammes, la requête est trop courte. */
const MIN_QUERY_TRIGRAMS = 8;
const CANDIDATE_VERSES = 60;
/** Écart de score sous lequel deux fenêtres sont jugées équivalentes. */
const TIE_EPSILON = 0.015;

export type Matcher = {
  match(transcript: string): MatchResult;
  surahs: SourceSurah[];
  options: MatcherOptions;
};

export function createMatcher(
  surahs: SourceSurah[],
  options: Partial<MatcherOptions> = {},
): Matcher {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const verses: IndexedVerse[] = [];
  const surahStart: number[] = [];

  for (const surah of surahs) {
    surahStart[surah.id] = verses.length;
    for (const verse of surah.verses) {
      const normalized = normalizeArabic(verse.text);
      const trigrams = trigramCodes(normalized);
      verses.push({
        surah: surah.id,
        ayah: verse.id,
        globalIndex: verses.length,
        normalized,
        trigrams,
        set: new Set(trigrams),
      });
    }
  }
  const verseCount = (s: number) => surahs[s - 1].verses.length;

  // Index inversé trigramme → versets.
  const postings = new Map<number, number[]>();
  for (const v of verses) {
    for (const code of v.trigrams) {
      let list = postings.get(code);
      if (!list) postings.set(code, (list = []));
      list.push(v.globalIndex);
    }
  }

  const hits = new Uint16Array(verses.length);

  function unionSize(start: number, end: number): number {
    if (start === end) return verses[start].trigrams.length;
    const all = new Set<number>();
    for (let g = start; g <= end; g++) {
      for (const code of verses[g].trigrams) all.add(code);
    }
    return all.size;
  }

  function scoreWindow(query: Int32Array, start: number, end: number): WindowScore {
    let inter = 0;
    for (const code of query) {
      for (let g = start; g <= end; g++) {
        if (verses[g].set.has(code)) {
          inter++;
          break;
        }
      }
    }
    const size = unionSize(start, end);
    const coverage = inter / query.length;
    const dice = (2 * inter) / (query.length + size);
    return {
      surah: verses[start].surah,
      verseStart: verses[start].ayah,
      verseEnd: verses[end].ayah,
      score: 0.7 * coverage + 0.3 * dice,
      coverage,
      dice,
    };
  }

  function match(transcript: string): MatchResult {
    const prepared = prepareQuery(transcript);
    const query = trigramCodes(prepared.normalized);
    const empty: MatchResult = {
      best: null,
      confidence: "low",
      isLongSurah: false,
      sameSurahAlternatives: [],
      otherSurahs: [],
      lowReason: "empty",
      queryLength: query.length,
    };
    if (query.length === 0) return empty;

    // 1. Comptage des trigrammes communs par verset.
    hits.fill(0);
    const touched: number[] = [];
    for (const code of query) {
      const list = postings.get(code);
      if (!list) continue;
      for (const g of list) {
        if (hits[g] === 0) touched.push(g);
        hits[g]++;
      }
    }
    if (touched.length === 0) return { ...empty, lowReason: "weak" };
    touched.sort((a, b) => hits[b] - hits[a]);
    const candidates = touched.slice(0, CANDIDATE_VERSES);

    // 2. Score exact des fenêtres de 1 à maxWindow versets contenant un candidat.
    const seen = new Set<string>();
    const windows: WindowScore[] = [];
    for (const g of candidates) {
      const s = verses[g].surah;
      const first = surahStart[s];
      const last = first + verseCount(s) - 1;
      for (let len = 1; len <= opts.maxWindow; len++) {
        for (let start = g - len + 1; start <= g; start++) {
          const end = start + len - 1;
          if (start < first || end > last) continue;
          const key = `${start}:${end}`;
          if (seen.has(key)) continue;
          seen.add(key);
          windows.push(scoreWindow(query, start, end));
        }
      }
    }
    windows.sort((a, b) => b.score - a.score || a.verseEnd - a.verseStart - (b.verseEnd - b.verseStart));
    const best = windows[0];

    // 3. Concurrents : meilleure fenêtre de chaque autre sourate.
    const otherSurahs: WindowScore[] = [];
    const surahSeen = new Set<number>([best.surah]);
    for (const w of windows) {
      if (surahSeen.has(w.surah)) continue;
      surahSeen.add(w.surah);
      otherSurahs.push(w);
      if (otherSurahs.length >= 3) break;
    }
    const runnerUp = otherSurahs[0]?.score ?? 0;
    const margin = best.score - runnerUp;

    // 4. Versets répétés dans la même sourate (fenêtres disjointes à égalité).
    const bestText = verses
      .slice(surahStart[best.surah] + best.verseStart - 1, surahStart[best.surah] + best.verseEnd)
      .map((v) => v.normalized)
      .join("");
    const sameSurahAlternatives: number[] = [];
    for (const w of windows) {
      if (w.surah !== best.surah || w === best) continue;
      if (w.verseStart <= best.verseEnd && w.verseEnd >= best.verseStart) continue;
      const text = verses
        .slice(surahStart[w.surah] + w.verseStart - 1, surahStart[w.surah] + w.verseEnd)
        .map((v) => v.normalized)
        .join("");
      if (text === bestText || best.score - w.score <= TIE_EPSILON) {
        if (!sameSurahAlternatives.includes(w.verseStart)) {
          sameSurahAlternatives.push(w.verseStart);
        }
      }
    }
    sameSurahAlternatives.sort((a, b) => a - b);

    // 5. Niveau de confiance : jamais plus assuré que le score ne le permet.
    let confidence: Confidence;
    let lowReason: MatchResult["lowReason"];
    if (prepared.basmalaOnly) {
      confidence = "low";
      lowReason = "basmala";
    } else if (query.length < MIN_QUERY_TRIGRAMS) {
      confidence = "low";
      lowReason = "short";
    } else if (best.score >= HIGH_SCORE && margin >= HIGH_MARGIN) {
      confidence = "high";
    } else if (best.score >= MEDIUM_SCORE && margin >= MEDIUM_MARGIN) {
      confidence = "medium";
    } else {
      confidence = "low";
      lowReason = best.score >= MEDIUM_SCORE ? "ambiguous" : "weak";
    }

    return {
      best,
      confidence,
      isLongSurah: verseCount(best.surah) >= opts.longSurahThreshold,
      sameSurahAlternatives,
      otherSurahs,
      lowReason,
      queryLength: query.length,
    };
  }

  return { match, surahs, options: opts };
}
