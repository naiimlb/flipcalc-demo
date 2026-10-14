import "server-only";
import { createMatcher, type Matcher, type SourceSurah } from "./matcher";
import { SURAHS } from "./data";

let matcher: Matcher | undefined;

/** Seuil « sourate longue », configurable par LONG_SURAH_THRESHOLD (défaut : 20 versets). */
function threshold(): number {
  const n = Number.parseInt(process.env.LONG_SURAH_THRESHOLD ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** Index construit une seule fois par instance serveur (~0,3 s). */
export function getMatcher(): Matcher {
  matcher ??= createMatcher(SURAHS as SourceSurah[], { longSurahThreshold: threshold() });
  return matcher;
}
