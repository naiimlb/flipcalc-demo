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
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
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

/**
 * Toutes les tâches d'une journée de service, triées dans l'ordre de la journée (sans filtre d'équipe).
 * `transferIn` : clés « tâche@journée » des tâches qu'un collègue m'a transmises ET que j'ai acceptées.
 */
export function planForService(tasks: Task[], sDate: Date, transferIn?: ReadonlySet<string>): PlannedTask[] {
  const dow = weekdayIndex(sDate);
  const key = dateKey(sDate);
  return tasks
    .filter((t) => {
      if (t.paused) return false;
      // Tâche transmise : elle n'existe pour moi QUE pour la journée acceptée (pas ses jours habituels).
      if (t.transferOnly) return transferIn?.has(`${t.id}@${key}`) === true;
      // Une tâche partagée n'entre dans mon planning qu'une fois acceptée (en attente ou refusée : pas de rappel).
      return (t.shareStatus === undefined || t.shareStatus === "accepted") && (t.date ? t.date === key : t.days.includes(dow));
    })
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
export function visiblePlan(tasks: Task[], sDate: Date, schedule: string | null, transferIn?: ReadonlySet<string>): PlannedTask[] {
  const plan = planForService(tasks, sDate, transferIn);
  const dp = dayPlanFor(schedule, sDate);
  if (dp === null) return plan;
  if (dp === "R") return [];
  const team: Team = dp === "J" ? "jour" : "soir";
  // Une tâche qu'un collègue m'a partagée est pour moi, quelle que soit son équipe.
  return plan.filter((p) => p.task.shareStatus !== undefined || p.task.transferOnly === true || p.task.team === "both" || p.task.team === team);
}

// ----- fin d'équipe, prochaine équipe -----
/** Fin de l'équipe en « minutes étendues » : relève pour l'équipe Jour, 2h du matin (1560) pour l'équipe Soir. */
export function teamEndExt(team: Team, handover: number): number {
  return team === "jour" ? handover : SERVICE_END + 24 * 60;
}

/** Équipe de ce jour d'après mon planning (null : repos ou pas indiqué). */
export function myTeam(schedule: string | null, sDate: Date): Team | null {
  const dp = dayPlanFor(schedule, sDate);
  return dp === "J" ? "jour" : dp === "S" ? "soir" : null;
}

/** Instant de la fin de l'équipe pour la journée de service `sDate`. */
export function teamEndAt(team: Team, handover: number, sDate: Date): Date {
  return slotInstant(sDate, teamEndExt(team, handover));
}

/** Prochaine équipe : Jour → équipe Soir du même jour ; Soir → équipe Jour du lendemain (11h). */
export function nextShift(team: Team, sDate: Date): { team: Team; date: Date } {
  return team === "jour" ? { team: "soir", date: sDate } : { team: "jour", date: addDays(sDate, 1) };
}

/** Début de l'équipe (11h pour le Jour, la relève pour le Soir), en minutes étendues. */
export function teamStartExt(team: Team, handover: number): number {
  return team === "jour" ? SERVICE_OPEN : handover;
}

/** Mode « un seul s'en occupe » : le collègue qui l'a prise (pas moi), sinon null. */
export function claimedByOther<C extends { userId: string }>(claims: Record<string, C> | undefined, key: string, uid: string): C | null {
  const c = claims?.[key];
  return c && c.userId !== uid ? c : null;
}

/** Instant du premier rappel (heure de la tâche moins l'avance choisie). */
export function reminderAt(p: PlannedTask): Date {
  return new Date(p.at.getTime() - p.task.remind * 60_000);
}

// ----- fréquence des rappels -----
export const MAX_SLOTS = 200; // garde-fou : jamais plus de 200 rappels pour une tâche et une journée

/** Instant d'une heure exprimée en « minutes étendues » (≥ 1440 = après minuit, donc le lendemain du jour de service). */
export function slotInstant(sDate: Date, ext: number): Date {
  const day = addDays(sDate, Math.floor(ext / 1440));
  const m = ((ext % 1440) + 1440) % 1440;
  return new Date(parisInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(m / 60), m % 60));
}

export type Slot = { at: Date; ext: number };

/**
 * Tous les rappels d'une tâche pour la journée de service `sDate` : le premier à (heure − avance), puis toutes les
 * `repeatEvery` minutes jusqu'à l'heure de fin. Les répétitions peuvent passer minuit (l'heure de fin 01h00 est
 * après 23h00). Calcul à l'heure de Paris : les créneaux de 11h à 2h ne croisent jamais le changement d'heure.
 */
export function notificationSlots(task: Task, sDate: Date): Slot[] {
  const first = sortKey(task.time) - task.remind;
  const exts = [first];
  if (task.repeatEvery && task.endTime && task.repeatEvery >= 5) {
    const end = sortKey(task.endTime);
    for (let m = first + task.repeatEvery; m <= end && exts.length < MAX_SLOTS; m += task.repeatEvery) exts.push(m);
  }
  return exts.map((ext) => ({ ext, at: slotInstant(sDate, ext) }));
}

/** Erreur de saisie de la fréquence (null si tout va bien). */
export function validateFrequency(task: Pick<Task, "time" | "repeatEvery" | "endTime">): string | null {
  if (!task.repeatEvery) return null;
  if (!Number.isInteger(task.repeatEvery) || task.repeatEvery < 5 || task.repeatEvery > 720) return "Choisis un intervalle entre 5 et 720 minutes.";
  if (!task.endTime) return "Choisis l'heure de fin des rappels.";
  if (sortKey(task.endTime) <= sortKey(task.time)) return "L'heure de fin doit être après l'heure de début.";
  return null;
}

function everyLabel(min: number): string {
  if (min === 60) return "toutes les heures";
  if (min > 60 && min % 60 === 0) return `toutes les ${min / 60} h`;
  return `toutes les ${min} min`;
}

/** Résumé en français affiché dans le formulaire : « Tu seras notifié toutes les 30 min, de 11h00 à 18h00… ». */
export function describeFrequency(task: Task): string {
  const lead = task.remind > 0 ? ` (premier rappel ${task.remind} min avant)` : "";
  if (!task.repeatEvery || !task.endTime) {
    return task.remind > 0
      ? `Tu seras notifié une seule fois, ${task.remind} min avant (à ${formatMinutes(sortKey(task.time) - task.remind)}).`
      : `Tu seras notifié une seule fois, à ${formatTime(task.time)}.`;
  }
  const n = notificationSlots(task, new Date(Date.UTC(2026, 0, 5))).length;
  const stop = task.untilDone ? ", jusqu'à ce que tu coches la tâche" : "";
  return `Tu seras notifié ${everyLabel(task.repeatEvery)}, de ${formatTime(task.time)} à ${formatTime(task.endTime)}${lead} : ${n} rappel${n > 1 ? "s" : ""} au plus${stop}.`;
}

/** Libellé court de la fréquence (listes). */
export function frequencyLabel(task: Task): string {
  if (task.repeatEvery && task.endTime) return `${everyLabel(task.repeatEvery)} jusqu'à ${formatTime(task.endTime)}`;
  return task.remind > 0 ? `${task.remind} min avant` : "à l'heure";
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
