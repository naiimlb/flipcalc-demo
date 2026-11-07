/**
 * Jours « calendaires » locaux au format AAAA-MM-JJ.
 * L'algorithme raisonne en jours entiers : pas d'heures, pas de fuseaux, pas de pièges d'heure d'été.
 */
export type DayKey = string;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isDayKey(value: string): value is DayKey {
  const m = DAY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Jour local de l'appareil pour une date donnée. */
export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUtcMs(day: DayKey): number {
  const m = DAY_RE.exec(day);
  if (!m || !isDayKey(day)) throw new RangeError(`Jour invalide : ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(day: DayKey, n: number): DayKey {
  const d = new Date(toUtcMs(day) + n * MS_PER_DAY);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}
