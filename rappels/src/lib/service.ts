import type { Task } from "./types";

/** Le service va de 19h00 à 03h00 : une heure avant 03h00 appartient au service de la VEILLE. */
export const SERVICE_START = 19 * 60;
export const SERVICE_END = 3 * 60;

export const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const DAY_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** Après minuit (donc le lendemain du jour de service). */
export function isAfterMidnight(time: string): boolean {
  return toMinutes(time) < SERVICE_END;
}

/** Clé de tri : 19h00 → 23h59 puis 00h00 → 02h55 (après minuit = + 24 h). */
export function sortKey(time: string): number {
  const m = toMinutes(time);
  return m < SERVICE_END ? m + 24 * 60 : m;
}

export function formatTime(time: string): string {
  const [h = "0", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}h${m.padStart(2, "0")}`;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-11-23" → Date locale à minuit. */
export function parseDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Jour (à minuit) du service auquel appartient « maintenant ».
 * À 01h30 un mardi, on est encore dans le service du lundi.
 * Entre 03h et 19h, on renvoie le service du soir à venir (celui d'aujourd'hui).
 */
export function serviceDate(now: Date): Date {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return minutes < SERVICE_END ? addDays(base, -1) : base;
}

/** Vrai pendant 19h → 3h. */
export function isServiceLive(now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= SERVICE_START || minutes < SERVICE_END;
}

/** Instant réel où la tâche tombe pour le service qui démarre le jour `sDate`. */
export function occurrenceAt(task: Pick<Task, "time">, sDate: Date): Date {
  const m = toMinutes(task.time);
  const day = addDays(sDate, isAfterMidnight(task.time) ? 1 : 0);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);
}

export type PlannedTask = {
  task: Task;
  at: Date;
  /** Clé de suivi (fait / notifié) : une par tâche et par service. */
  key: string;
  afterMidnight: boolean;
};

/** Tâches d'un service donné, triées dans l'ordre du service (19h → 3h). */
export function planForService(tasks: Task[], sDate: Date): PlannedTask[] {
  const dow = weekdayIndex(sDate);
  const key = dateKey(sDate);
  return tasks
    .filter((t) => (t.date ? t.date === key : t.days.includes(dow)))
    .map((task) => ({
      task,
      at: occurrenceAt(task, sDate),
      key: `${task.id}@${dateKey(sDate)}`,
      afterMidnight: isAfterMidnight(task.time),
    }))
    .sort((a, b) => sortKey(a.task.time) - sortKey(b.task.time) || a.task.title.localeCompare(b.task.title, "fr"));
}

/** Instant d'envoi du rappel (heure de la tâche moins l'avance choisie). */
export function reminderAt(p: PlannedTask): Date {
  return new Date(p.at.getTime() - p.task.remind * 60_000);
}

export function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

export function reminderLabel(remind: number): string {
  return remind === 0 ? "À l'heure" : `${remind} min avant`;
}

export function formatServiceDate(sDate: Date): string {
  return `${DAY_LONG[weekdayIndex(sDate)]} ${sDate.getDate()} ${sDate.toLocaleDateString("fr-FR", { month: "long" })}`;
}
