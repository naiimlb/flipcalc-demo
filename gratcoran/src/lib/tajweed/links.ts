import type { PassageRef } from "./analyze";

/** Lien vers le parcours de pratique d'un passage (segment compris). */
export function pratiqueHref(ref: PassageRef): string {
  const base = `/tajweed/pratique?s=${ref.surah}&from=${ref.verseStart}&to=${ref.verseEnd}`;
  return ref.wordStart != null && ref.wordEnd != null ? `${base}&ws=${ref.wordStart}&we=${ref.wordEnd}` : base;
}

export function parcoursHref(key: string): string {
  return `/tajweed/parcours/${encodeURIComponent(key)}`;
}
