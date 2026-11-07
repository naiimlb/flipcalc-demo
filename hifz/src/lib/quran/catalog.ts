import raw from "./generated/quran-index.json";
import type { QuranIndex, Reciter, SurahMeta, VerseKey } from "./types";

/** Index généré (validé par les tests : tests/quran-data.test.ts). */
export const quranIndex = raw as QuranIndex;

export const surahs: readonly SurahMeta[] = quranIndex.surahs;
export const reciters: readonly Reciter[] = quranIndex.reciters;
export const defaultReciterId = quranIndex.defaultReciter;
export const basmalaText = quranIndex.basmala;

export function getSurahMeta(number: number): SurahMeta | undefined {
  return surahs[number - 1];
}

export function getReciter(id: string): Reciter {
  return reciters.find((r) => r.id === id) ?? reciters[0]!;
}

export function verseKey(surah: number, ayah: number): VerseKey {
  return `${surah}:${ayah}`;
}

export function parseVerseKey(key: string): { surah: number; ayah: number } | null {
  const m = /^(\d{1,3}):(\d{1,3})$/.exec(key);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  const meta = getSurahMeta(surah);
  if (!meta || ayah < 1 || ayah > meta.ayahCount) return null;
  return { surah, ayah };
}

/** Vérifie qu'une plage de versets existe dans la sourate. */
export function isValidRange(surah: number, from: number, to: number): boolean {
  const meta = getSurahMeta(surah);
  return !!meta && Number.isInteger(from) && Number.isInteger(to) && from >= 1 && from <= to && to <= meta.ayahCount;
}

/** Recherche simple par numéro, translittération ou nom arabe (sans voyelles). */
export function searchSurahs(query: string): SurahMeta[] {
  const trimmed = query.trim();
  if (!trimmed) return [...surahs];
  if (/^\d{1,3}$/.test(trimmed)) return surahs.filter((s) => String(s.number).startsWith(trimmed));
  const q = normalizeLatin(trimmed);
  const arabic = stripArabicMarks(trimmed);
  return surahs.filter(
    (s) => (q.length > 0 && normalizeLatin(s.transliteration).includes(q)) || (arabic.length > 0 && stripArabicMarks(s.nameAr).includes(arabic)),
  );
}

/** Translittération simplifiée : « Al-Faatiha », « fatiha » et « Fâtiha » se rejoignent. */
function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ee/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/q/g, "k")
    .replace(/([a-z])\1+/g, "$1");
}

/** Pour la recherche uniquement : retire voyelles et signes (le texte affiché n'est jamais modifié). */
function stripArabicMarks(s: string): string {
  return s.replace(/[ً-ٰٟۖ-ۭـ\s]/g, "").replace(/[ٱآأإ]/g, "ا");
}
