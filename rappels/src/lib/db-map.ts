import type { Category, Profile, Reminder, Role, Settings, Task } from "./types";

// Correspondance entre l'app (Task…) et les lignes de la base (supabase/schema.sql).
export type TaskRow = {
  id: string;
  user_id: string;
  assigned_by: string | null;
  title: string;
  category: string;
  at_time: string;
  days: number[];
  once_date: string | null;
  remind: number;
  note: string | null;
};
export type SettingsRow = { default_remind: number; notify: boolean };
export type ProfileRow = { id: string; email: string; prenom: string; role: string };
export type DoneRow = { task_id: string; service_date: string };

export function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    category: r.category as Category,
    time: r.at_time,
    days: [...r.days].sort((a, b) => a - b),
    ...(r.once_date ? { date: r.once_date } : {}),
    remind: r.remind as Reminder,
    ...(r.note ? { note: r.note } : {}),
    ...(r.assigned_by ? { assigned: true } : {}),
  };
}

/** Colonnes modifiables d'une tâche (jamais user_id ni assigned_by). */
export function taskToFields(t: Task) {
  return {
    title: t.title,
    category: t.category,
    at_time: t.time,
    days: t.days,
    once_date: t.date ?? null,
    remind: t.remind,
    note: t.note ?? null,
  };
}

export const rowToProfile = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, prenom: r.prenom, role: r.role === "responsable" ? "responsable" : ("caissier" satisfies Role) });

export const rowToSettings = (r: SettingsRow | null): Settings => ({
  defaultRemind: ([0, 5, 15].includes(r?.default_remind ?? 5) ? (r?.default_remind ?? 5) : 5) as Reminder,
  notify: r?.notify ?? true,
});

export const doneKey = (taskId: string, serviceDate: string) => `${taskId}@${serviceDate}`;
export function parseDoneKey(key: string): { taskId: string; serviceDate: string } {
  const [taskId = "", serviceDate = ""] = key.split("@");
  return { taskId, serviceDate };
}
