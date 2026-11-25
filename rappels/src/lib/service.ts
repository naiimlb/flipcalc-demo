import type { Task } from "./types";

// ---------------------------------------------------------------------------------------------
// Journée de service : de 11h à 2h du matin (Europe/Paris). Une heure avant 02h00 appartient à la
// journée de service de la VEILLE. Les premières tâches (ouverture de caisse) peuvent précéder 11h.
// Tous les calculs se font à l'heure de Paris, quel que soit le fuseau du téléphone, et gèrent
// le passage heure d'été / heure d'hiver.
// ---------------------------------------------------------------------------------------------
export const TZ = "Europe/Paris";
export const SERVICE_OPEN = 11 * 60; // ouverture au public
export const SERVICE_END = 2 * 60; // fin de la journée de service (02h00)
export const PREP_START = 10 * 60 + 30; // plus tôt possible pour une tâche (ouverture de caisse avant 11h)

export const HANDOVER_CHOICES = [1080, 1110] as const; // relève à 18h00 ou 18h30
export type Handover = (typeof HANDOVER_CHOICES)[number];
export const DEFAULT_HANDOVER: Handover = 1110;

export type Team = "jour" | "soir";
export type TeamPref = Team | "both";
/** Planning d'une journée : J = équipe Jour, S = équipe Soir, R = repos, - = pas indiqué. */
export type DayPlan = "J" | "S" | "R" | "-";
export const TEAM_LABEL: Record<TeamPref, string> = { jour: "Équipe jour", soir: "Équipe soir", both: "Les deux" };

export const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const DAY_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// ----- heure de Paris -----
const parisFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function parisParts(ms: number): { y: number; m: number; d: number; h: number; min: number } {
  const get: Record<string, number> = {};
  for (const p of parisFmt.formatToParts(new Date(ms))) if (p.type !== "literal") get[p.type] = Number(p.value);
  return { y: get.year ?? 1970, m: get.month ?? 1, d: get.day ?? 1, h: get.hour ?? 0, min: get.minute ?? 0 };
}

/** Écart (ms) entre l'heure de Paris et UTC à cet instant : +1 h l'hiver, +2 h l'été. */
function parisOffsetMs(ms: number): number {
  const t = Math.floor(ms / 60_000) * 60_000;
  const p = parisParts(t);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - t;
}

/** Instant (ms) correspondant à une heure « murale » de Paris. */
export function parisInstant(y: number, m: number, d: number, h: number, min: number): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  return guess - parisOffsetMs(guess - parisOffsetMs(guess));
}

/** Minutes écoulées depuis minuit, à Paris. */
export function parisMinutes(now: Date): number {
  const p = parisParts(now.getTime());
  return p.h * 60 + p.min;
}

// ----- dates calendaires : un Date à minuit UTC représente un jour (sans notion de fuseau) -----
export function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** "2026-11-23" → jour calendaire. */
export function parseDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

// ----- heures de tâche -----
export function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** Après minuit (donc le lendemain du jour de service). */
export function isAfterMidnight(time: string): boolean {
  return toMinutes(time) < SERVICE_END;
}

/** Clé de tri : 10h30 → 23h59 puis 00h00 → 01h55 (après minuit = + 24 h). */
export function sortKey(time: string): number {
  const m = toMinutes(time);
  return m < SERVICE_END ? m + 24 * 60 : m;
}

export function formatTime(time: string): string {
  const [h = "0", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}h${m.padStart(2, "0")}`;
}

export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;
}

export function minutesToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Jour calendaire de la journée de service en cours. À 01h30 un mardi, on est encore dans la journée du lundi.
 * Entre 02h et 11h, on renvoie la journée du jour qui commence.
 */
export function serviceDate(now: Date): Date {
  const p = parisParts(now.getTime());
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return p.h * 60 + p.min < SERVICE_END ? addDays(base, -1) : base;
}

/** Vrai pendant 11h → 2h. */
export function isServiceLive(now: Date): boolean {
  const m = parisMinutes(now);
  return m >= SERVICE_OPEN || m < SERVICE_END;
}

/** Instant réel où la tâche tombe pour la journée de service qui démarre le jour `sDate`. */
export function occurrenceAt(task: Pick<Task, "time">, sDate: Date): Date {
  const m = toMinutes(task.time);
  const day = addDays(sDate, isAfterMidnight(task.time) ? 1 : 0);
  return new Date(parisInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(m / 60), m % 60));
}

// ----- équipes -----
/** Équipe de travail ce jour-là d'après le planning (null si non indiqué). */
export function dayPlanFor(schedule: string | null, sDate: Date): DayPlan | null {
  if (!schedule || schedule.length !== 7) return null;
  const c = schedule[weekdayIndex(sDate)];
  return c === "J" || c === "S" || c === "R" ? c : null;
}

/** Plage horaire (en clés de tri, bornes incluses) d'une équipe. */
export function teamRange(team: TeamPref, handover: number): [number, number] {
  const end = SERVICE_END + 24 * 60 - 1;
  if (team === "jour") return [PREP_START, handover];
  if (team === "soir") return [handover, end];
  return [PREP_START, end];
}

export function isOutsideTeamRange(time: string, team: TeamPref, handover: number): boolean {
  const [from, to] = teamRange(team, handover);
  const k = sortKey(time);
  return k < from || k > to;
}

/** Heure hors des horaires du restaurant (entre 02h00 et 10h30) : anciennes tâches à revoir. */
export function isOutsideService(time: string): boolean {
  const m = toMinutes(time);
  return m >= SERVICE_END && m < PREP_START;
}

export type PlannedTask = {
  task: Task;
  at: Date;
  /** Clé de suivi (fait / notifié) : une par tâche et par journée de service. */
  key: string;
  afterMidnight: boolean;
};

/** Toutes les tâches d'une journée de service, triées dans l'ordre de la journée (sans filtre d'équipe). */
export function planForService(tasks: Task[], sDate: Date): PlannedTask[] {
  const dow = weekdayIndex(sDate);
  const key = dateKey(sDate);
  return tasks
    .filter((t) => (t.date ? t.date === key : t.days.includes(dow)))
    .map((task) => ({
      task,
      at: occurrenceAt(task, sDate),
      key: `${task.id}@${key}`,
      afterMidnight: isAfterMidnight(task.time),
    }))
    .sort((a, b) => sortKey(a.task.time) - sortKey(b.task.time) || a.task.title.localeCompare(b.task.title, "fr"));
}

/**
 * Tâches à afficher (et à rappeler) pour ce caissier ce jour-là : celles de SON équipe d'après son planning.
 * Planning non indiqué : toutes les tâches. Jour de repos : aucune.
 */
export function visiblePlan(tasks: Task[], sDate: Date, schedule: string | null): PlannedTask[] {
  const plan = planForService(tasks, sDate);
  const dp = dayPlanFor(schedule, sDate);
  if (dp === null) return plan;
  if (dp === "R") return [];
  const team: Team = dp === "J" ? "jour" : "soir";
  return plan.filter((p) => p.task.team === "both" || p.task.team === team);
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
  return `${DAY_LONG[weekdayIndex(sDate)]} ${sDate.getUTCDate()} ${sDate.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" })}`;
}
