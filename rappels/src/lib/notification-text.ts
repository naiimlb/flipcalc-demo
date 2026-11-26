import { formatTime, sortKey } from "./service";
import type { Task } from "./types";

export type NotificationContent = { title: string; body: string };

/** Texte du push, identique pour l'aperçu, le test, les rappels dans l'app et les vrais push du serveur. */
export function buildNotification(task: Task, serviceLabel?: string): NotificationContent {
  const lead = task.remind === 0 ? "c'est l'heure !" : `dans ${task.remind} min, prépare-toi !`;
  const where = serviceLabel ? ` · ${serviceLabel}` : "";
  return { title: `⏰ ${task.title}`, body: `${formatTime(task.time)} · ${task.category}${where} — ${lead}` };
}

/** Texte d'un rappel précis d'une série (`ext` = minutes étendues du créneau). */
export function buildSlotNotification(task: Task, ext: number): NotificationContent {
  const diff = sortKey(task.time) - ext; // > 0 : avant l'heure, 0 : à l'heure, < 0 : après
  const lead = diff > 0 ? `dans ${diff} min, prépare-toi !` : diff === 0 ? "c'est l'heure !" : `toujours à faire (depuis ${-diff} min) !`;
  return { title: `⏰ ${task.title}`, body: `${formatTime(task.time)} · ${task.category} — ${lead}` };
}
