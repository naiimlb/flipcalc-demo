"use client";

import { CATEGORIES, REMINDERS, type Category, type Reminder, type Task } from "./types";
import { updateState } from "./store";

// Anciennes données : avant les comptes, les tâches vivaient dans le localStorage du téléphone.
const LEGACY_KEY = "hb-rappels:v1";
const dismissedKey = (uid: string) => `hb-import-dismissed:${uid}`;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Garde uniquement une tâche valide (on ne fait pas confiance aux anciennes données), sinon null. */
export function sanitizeLocalTask(raw: unknown): Task | null {
  if (!isObj(raw) || typeof raw.title !== "string" || typeof raw.time !== "string") return null;
  const title = raw.title.trim().slice(0, 60);
  if (!title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time)) return null;
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : undefined;
  if (days.length === 0 && !date) return null;
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, 200) : undefined;
  return {
    id: crypto.randomUUID(),
    title,
    category: (CATEGORIES as readonly string[]).includes(String(raw.category)) ? (raw.category as Category) : "Autre",
    time: raw.time,
    days: days.length ? days : [0],
    ...(date ? { date } : {}),
    team: "both", // les anciennes tâches restent visibles pour les deux équipes
    remind: (REMINDERS as readonly number[]).includes(Number(raw.remind)) ? (Number(raw.remind) as Reminder) : 5,
    ...(note ? { note } : {}),
  };
}

/** Tâches trouvées dans le localStorage de ce téléphone (vide s'il n'y en a pas). */
export function readLocalTasks(): Task[] {
  try {
    const data = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null") as unknown;
    if (!isObj(data) || !Array.isArray(data.tasks)) return [];
    return data.tasks.map(sanitizeLocalTask).filter((t): t is Task => t !== null);
  } catch {
    return [];
  }
}

export const isImportDismissed = (uid: string) => {
  try {
    return localStorage.getItem(dismissedKey(uid)) === "1";
  } catch {
    return false;
  }
};

export function dismissImport(uid: string) {
  try {
    localStorage.setItem(dismissedKey(uid), "1");
  } catch {
    /* ignoré */
  }
}

/**
 * Importe les tâches du téléphone dans le compte. Les anciennes données ne sont effacées
 * qu'une fois l'enregistrement confirmé par la base. Renvoie le nombre de tâches importées (ou -1 en cas d'échec).
 */
export async function importLocalTasks(): Promise<number> {
  const tasks = readLocalTasks();
  if (tasks.length === 0) return 0;
  const ok = await updateState((s) => ({ ...s, tasks: [...s.tasks, ...tasks] }));
  if (!ok) return -1;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignoré */
  }
  return tasks.length;
}
