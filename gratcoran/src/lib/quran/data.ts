import raw from "quran-json/dist/quran_fr.json";
import type { SourceSurah } from "./matcher";

/**
 * Texte du Coran (uthmani) et traduction française, tels que fournis
 * par le paquet npm `quran-json`. Ces données ne sont jamais modifiées.
 */
export const SURAHS: readonly SourceSurah[] = raw as unknown as SourceSurah[];

export function getSurah(id: number): SourceSurah | undefined {
  return SURAHS[id - 1];
}
