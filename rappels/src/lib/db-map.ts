import type { Handover, TeamPref } from "./service";
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
  team: string;
  remind: number;
  repeat_every: number | null;
  end_time: string | null;
  until_done: boolean;
  paused: boolean;
  note: string | null;
  share_mode?: string | null;
};
export type SettingsRow = { default_remind: number; notify: boolean; handover_min: number; schedule: string | null };
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
    team: (r.team === "jour" || r.team === "soir" ? r.team : "both") as TeamPref,
    remind: r.remind,
    ...(r.repeat_every && r.end_time ? { repeatEvery: r.repeat_every, endTime: r.end_time } : {}),
    untilDone: r.until_done !== false,
    paused: r.paused === true,
    ...(r.note ? { note: r.note } : {}),
    ...(r.assigned_by ? { assigned: true } : {}),
    ownerId: r.user_id,
    ...(r.share_mode === "each" || r.share_mode === "one" ? { shareMode: r.share_mode } : {}),
  };
}

export type SharedMeta = { task_id: string; owner_prenom: string; status: string };
/** Ajoute aux tâches reçues d'un collègue son prénom et ma réponse (en attente, acceptée, refusée). */
export function applySharedMeta(tasks: Task[], meta: SharedMeta[], uid: string): Task[] {
  const byTask = new Map(meta.map((m) => [m.task_id, m]));
  return tasks.map((t) => {
    const m = byTask.get(t.id);
    if (!m || t.ownerId === uid) return t;
    return { ...t, sharedBy: m.owner_prenom, shareStatus: (m.status === "accepted" || m.status === "declined" ? m.status : "pending") as Task["shareStatus"] };
  });
}

/** Colonnes modifiables d'une tâche (jamais user_id ni assigned_by). */
export function taskToFields(t: Task) {
  return {
    title: t.title,
    category: t.category,
    at_time: t.time,
    days: t.days,
    once_date: t.date ?? null,
    team: t.team,
    remind: t.remind,
    repeat_every: t.repeatEvery && t.endTime ? t.repeatEvery : null,
    end_time: t.repeatEvery && t.endTime ? t.endTime : null,
    until_done: t.untilDone,
    paused: t.paused,
    note: t.note ?? null,
  };
}

export const rowToProfile = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, prenom: r.prenom, role: r.role === "responsable" ? "responsable" : ("caissier" satisfies Role) });

export const rowToSettings = (r: SettingsRow | null): Settings => ({
  defaultRemind: ([0, 5, 15].includes(r?.default_remind ?? 5) ? (r?.default_remind ?? 5) : 5) as Reminder,
  notify: r?.notify ?? true,
  handover: (r?.handover_min === 1080 ? 1080 : 1110) as Handover,
  schedule: r?.schedule && /^[JSR-]{7}$/.test(r.schedule) ? r.schedule : null,
});

export const doneKey = (taskId: string, serviceDate: string) => `${taskId}@${serviceDate}`;
export function parseDoneKey(key: string): { taskId: string; serviceDate: string } {
  const [taskId = "", serviceDate = ""] = key.split("@");
  return { taskId, serviceDate };
}
