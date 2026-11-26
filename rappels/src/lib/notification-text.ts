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

/** Adresse de la page d'une tâche pour une journée de service : ce que la notification ouvre. */
export const taskUrl = (taskId: string, serviceDate: string) => `/taches/${taskId}?j=${serviceDate}`;

/** Relance : personne n'a réagi au rappel précédent. */
export function buildRelanceNotification(title: string): NotificationContent {
  return { title: `🔔 Rappel : ${title}`, body: "Touche pour ouvrir la tâche." };
}

/** Rappel reporté (« Reporter de 10 min ») qui revient. */
export function buildPostponedNotification(title: string): NotificationContent {
  return { title: `⏱️ C'est reparti : ${title}`, body: "Tu avais reporté cette tâche. Touche pour l'ouvrir." };
}

/** Un collègue t'a partagé une tâche. */
export function buildShareNotification(ownerPrenom: string, title: string): NotificationContent {
  return { title: `${ownerPrenom} t'a partagé une tâche : ${title}`, body: "Touche pour accepter ou refuser." };
}

/** Un collègue s'occupe de la tâche : plus besoin de t'en occuper. */
export function buildClaimNotification(claimerPrenom: string, title: string): NotificationContent {
  return { title: `🙌 ${claimerPrenom} s'en occupe : ${title}`, body: "Tu n'as plus rien à faire pour celle-ci." };
}
