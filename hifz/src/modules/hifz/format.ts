import { getSurahMeta } from "@/lib/quran/catalog";
import { diffDays, type DayKey } from "@/lib/srs/dates";

export function surahName(number: number): string {
  return getSurahMeta(number)?.transliteration ?? `Sourate ${number}`;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

/** « aujourd'hui », « demain », « dans 5 jours », « le 12 mars ». */
export function relativeDay(day: DayKey, today: DayKey): string {
  const d = diffDays(today, day);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "demain";
  if (d < 14) return `dans ${d} jours`;
  const [y, m, dd] = day.split("-").map(Number);
  return `le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(y!, m! - 1, dd!))}`;
}

export function rangeLabel(surah: number, from: number, to: number): string {
  const meta = getSurahMeta(surah);
  if (meta && from === 1 && to === meta.ayahCount) return "Sourate entière";
  return from === to ? `Verset ${from}` : `Versets ${from} à ${to}`;
}
