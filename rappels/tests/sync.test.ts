import { describe, expect, it } from "vitest";
import { doneKey, parseDoneKey, rowToTask, taskToFields, type TaskRow } from "@/lib/db-map";
import { sanitizeLocalTask } from "@/lib/local-import";
import { diffState, isEmptyOps } from "@/lib/sync-diff";
import type { AppState, Task } from "@/lib/types";

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: "Ouvrir la caisse", category: "Caisse", time: "19:00", days: [0, 1], team: "both", remind: 5, ...extra });
const state = (extra: Partial<AppState> = {}): AppState => ({
  tasks: [task("a"), task("b")],
  done: {},
  notified: {},
  settings: { defaultRemind: 5, notify: true, handover: 1110, schedule: null },
  profile: { id: "u1", email: "l@hb.fr", prenom: "Léa", role: "caissier" },
  ...extra,
});

describe("diffState : ce qui part dans la base", () => {
  it("ne fait rien si rien n'a changé (et ignore les rappels déjà envoyés, propres à l'appareil)", () => {
    const s = state();
    expect(isEmptyOps(diffState(s, { ...s, notified: { "a@2026-11-23": true } }))).toBe(true);
  });

  it("détecte ajout, modification et suppression de tâches", () => {
    const prev = state();
    const next = state({ tasks: [task("a", { title: "Nouveau titre" }), task("c")] });
    const ops = diffState(prev, next);
    expect(ops.taskInserts.map((t) => t.id)).toEqual(["c"]);
    expect(ops.taskUpdates.map((t) => t.id)).toEqual(["a"]);
    expect(ops.taskDeletes).toEqual(["b"]);
  });

  it("détecte les tâches cochées / décochées", () => {
    const prev = state({ done: { "a@2026-11-23": true } });
    const ops = diffState(prev, state({ done: { "b@2026-11-23": true } }));
    expect(ops.doneAdds).toEqual(["b@2026-11-23"]);
    expect(ops.doneRemoves).toEqual(["a@2026-11-23"]);
  });

  it("détecte réglages et prénom", () => {
    const ops = diffState(state(), state({ settings: { defaultRemind: 15, notify: true, handover: 1110, schedule: null }, profile: { id: "u1", email: "l@hb.fr", prenom: "Léa B.", role: "caissier" } }));
    expect(ops.settingsChanged && ops.profileChanged).toBe(true);
  });

  it("détecte relève, planning et équipe d'une tâche", () => {
    expect(diffState(state(), state({ settings: { defaultRemind: 5, notify: true, handover: 1080, schedule: null } })).settingsChanged).toBe(true);
    expect(diffState(state(), state({ settings: { defaultRemind: 5, notify: true, handover: 1110, schedule: "JSRJSR-" } })).settingsChanged).toBe(true);
    expect(diffState(state(), state({ tasks: [task("a", { team: "soir" }), task("b")] })).taskUpdates.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("correspondance base ↔ app", () => {
  const row: TaskRow = { id: "x", user_id: "u1", assigned_by: "boss", title: "Frigo", category: "Stock", at_time: "00:30", days: [4, 0], once_date: "2026-11-23", team: "soir", remind: 15, note: null };

  it("lit une ligne de la base", () => {
    expect(rowToTask(row)).toEqual({ id: "x", title: "Frigo", category: "Stock", time: "00:30", days: [0, 4], date: "2026-11-23", team: "soir", remind: 15, assigned: true });
  });

  it("n'écrit jamais user_id ni assigned_by dans les champs modifiables", () => {
    const fields = taskToFields(rowToTask(row));
    expect(Object.keys(fields)).not.toContain("user_id");
    expect(Object.keys(fields)).not.toContain("assigned_by");
    expect(fields).toMatchObject({ at_time: "00:30", once_date: "2026-11-23", note: null });
  });

  it("clé « fait » aller-retour", () => {
    expect(parseDoneKey(doneKey("abc", "2026-11-23"))).toEqual({ taskId: "abc", serviceDate: "2026-11-23" });
  });
});

describe("import des anciennes tâches du téléphone", () => {
  it("garde une tâche valide avec un nouvel identifiant", () => {
    const t = sanitizeLocalTask({ id: "ex-ouverture", title: " Ouvrir la caisse ", category: "Caisse", time: "19:00", days: [0, 1, 1, 9], remind: 5 });
    expect(t).toMatchObject({ title: "Ouvrir la caisse", days: [0, 1], remind: 5, team: "both" });
    expect(t?.id).not.toBe("ex-ouverture");
  });

  it("corrige ce qui est douteux et refuse ce qui est inutilisable", () => {
    expect(sanitizeLocalTask({ title: "X", category: "Piscine", time: "20:00", days: [2], remind: 7 })).toMatchObject({ category: "Autre", remind: 5 });
    expect(sanitizeLocalTask({ title: "X", category: "Caisse", time: "25:00", days: [2] })).toBeNull();
    expect(sanitizeLocalTask({ title: "", category: "Caisse", time: "20:00", days: [2] })).toBeNull();
    expect(sanitizeLocalTask({ title: "X", category: "Caisse", time: "20:00", days: [] })).toBeNull();
    expect(sanitizeLocalTask("n'importe quoi")).toBeNull();
  });
});
