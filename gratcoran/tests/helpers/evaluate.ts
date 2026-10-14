import type { Matcher } from "../../src/lib/quran/matcher";
import { DEFAULT_NOISE, noisyExtract, rng, type NoiseOptions } from "./noise";

export type Evaluation = {
  samples: number;
  surahAccuracy: number;
  /** Sur les extraits de sourates longues : fenêtre prédite ∩ versets réels ≠ ∅. */
  verseAccuracy: number;
  longSamples: number;
  /** Part des réponses « haute » confiance, et leur précision. */
  highShare: number;
  highPrecision: number;
  mediumShare: number;
  mediumPrecision: number;
  lowShare: number;
  msPerQuery: number;
};

export function evaluate(
  matcher: Matcher,
  samples: number,
  seed: number,
  noise: NoiseOptions = DEFAULT_NOISE,
): Evaluation {
  const random = rng(seed);
  let surahOk = 0;
  let verseOk = 0;
  let longSamples = 0;
  const byLevel = { high: [0, 0], medium: [0, 0], low: [0, 0] };
  const t0 = performance.now();

  for (let i = 0; i < samples; i++) {
    const ex = noisyExtract(matcher.surahs, random, noise);
    const res = matcher.match(ex.text);
    const okSurah = res.best?.surah === ex.surah;
    if (okSurah) surahOk++;
    byLevel[res.confidence][0]++;
    if (okSurah) byLevel[res.confidence][1]++;

    if (matcher.surahs[ex.surah - 1].verses.length >= matcher.options.longSurahThreshold) {
      longSamples++;
      const b = res.best;
      const overlaps = (s: number, e: number) => s <= ex.verseEnd && e >= ex.verseStart;
      if (
        okSurah &&
        b &&
        (overlaps(b.verseStart, b.verseEnd) ||
          res.sameSurahAlternatives.some((v) => overlaps(v, v)))
      ) {
        verseOk++;
      }
    }
  }

  const ms = (performance.now() - t0) / samples;
  const share = (n: number) => n / samples;
  const prec = ([n, ok]: number[]) => (n ? ok / n : 1);
  return {
    samples,
    surahAccuracy: surahOk / samples,
    verseAccuracy: longSamples ? verseOk / longSamples : 1,
    longSamples,
    highShare: share(byLevel.high[0]),
    highPrecision: prec(byLevel.high),
    mediumShare: share(byLevel.medium[0]),
    mediumPrecision: prec(byLevel.medium),
    lowShare: share(byLevel.low[0]),
    msPerQuery: ms,
  };
}

export function formatEvaluation(label: string, e: Evaluation): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
  return [
    `${label} — ${e.samples} extraits`,
    `  sourate correcte : ${pct(e.surahAccuracy)}`,
    `  verset correct (sourates longues, n=${e.longSamples}) : ${pct(e.verseAccuracy)}`,
    `  confiance haute : ${pct(e.highShare)} des réponses, précision ${pct(e.highPrecision)}`,
    `  confiance moyenne : ${pct(e.mediumShare)} des réponses, précision ${pct(e.mediumPrecision)}`,
    `  confiance faible : ${pct(e.lowShare)} des réponses`,
    `  temps moyen : ${e.msPerQuery.toFixed(2)} ms / requête`,
  ].join("\n");
}
