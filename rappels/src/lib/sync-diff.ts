import type { AppState, Task } from "./types";

// Compare deux états de l'app et dit ce qu'il faut écrire dans la base (pur, testable).
export type SyncOps = {
  taskInserts: Task[];
  taskUpdates: Task[];
  taskDeletes: string[];
  doneAdds: string[];
  doneRemoves: string[];
  settingsChanged: boolean;
  profileChanged: boolean;
};

const sig = (t: Task) => JSON.stringify([t.title, t.category, t.time, t.days, t.date ?? null, t.team, t.remind, t.note ?? null]);

export function diffState(prev: AppState, next: AppState): SyncOps {
  const before = new Map(prev.tasks.map((t) => [t.id, t]));
  const after = new Map(next.tasks.map((t) => [t.id, t]));
  return {
    taskInserts: next.tasks.filter((t) => !before.has(t.id)),
    taskUpdates: next.tasks.filter((t) => {
      const old = before.get(t.id);
      return old !== undefined && sig(old) !== sig(t);
    }),
    taskDeletes: prev.tasks.filter((t) => !after.has(t.id)).map((t) => t.id),
    doneAdds: Object.keys(next.done).filter((k) => !prev.done[k]),
    doneRemoves: Object.keys(prev.done).filter((k) => !next.done[k]),
    settingsChanged: prev.settings.defaultRemind !== next.settings.defaultRemind || prev.settings.notify !== next.settings.notify ||
      prev.settings.handover !== next.settings.handover ||
      prev.settings.schedule !== next.settings.schedule,
    profileChanged: prev.profile.prenom !== next.profile.prenom,
  };
}

export const isEmptyOps = (o: SyncOps) =>
  !o.taskInserts.length && !o.taskUpdates.length && !o.taskDeletes.length && !o.doneAdds.length && !o.doneRemoves.length && !o.settingsChanged && !o.profileChanged;
