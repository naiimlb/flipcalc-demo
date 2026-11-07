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
  const q = normalizeLatin(query);
  if (!q) return [...surahs];
  return surahs.filter((s) => {
    if (String(s.number) === q) return true;
    if (normalizeLatin(s.transliteration).includes(q)) return true;
    return stripArabicMarks(s.nameAr).includes(stripArabicMarks(query.trim()));
  });
}

function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Pour la recherche uniquement : retire voyelles et signes (le texte affiché n'est jamais modifié). */
function stripArabicMarks(s: string): string {
  return s.replace(/[ً-ٰٟۖ-ۭـ\s]/g, "").replace(/[ٱآأإ]/g, "ا");
}
