import { describe, expect, it } from "vitest";
import { bilanAt, historyStatus, pendingTasks, shiftOver, type BilanInput } from "@/lib/bilan";
import { applySharedMeta, rowToSettings, rowToTransfer, rowToTask, type TaskRow } from "@/lib/db-map";
import { nextShift, parseDateKey, planForService, teamEndAt, teamEndExt, teamStartExt, visiblePlan } from "@/lib/service";
import { OCC_LABEL, type Task } from "@/lib/types";

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, category: "Autre", time: "14:00", days: [0, 1, 2, 3, 4, 5, 6], team: "both", remind: 0, untilDone: true, paused: false, ...extra });
const MON = parseDateKey("2026-11-23");
const input = (tasks: Task[], extra: Partial<BilanInput> = {}): BilanInput => ({ tasks, uid: "me", handover: 1110, transferIn: new Set(), isDone: () => false, holder: () => undefined, outcome: () => undefined, ...extra });

describe("bilan : tâches non faites", () => {
  it("équipe Jour : mes tâches Jour + « les deux » avant la relève, pas celles du soir", () => {
    const ts = [task("a", { team: "jour", time: "12:00" }), task("b", { team: "both", time: "17:00" }), task("c", { team: "both", time: "20:00" }), task("d", { team: "soir", time: "19:00" })];
    expect(pendingTasks(input(ts), MON, "jour").map((p) => p.task.id)).toEqual(["a", "b"]);
  });
  it("équipe Soir : de la relève à 02h00, y compris après minuit (journée de la veille)", () => {
    const ts = [task("a", { team: "soir", time: "19:00" }), task("b", { team: "both", time: "01:30" }), task("c", { team: "jour", time: "12:00" }), task("d", { team: "both", time: "12:00" })];
    expect(pendingTasks(input(ts), MON, "soir").map((p) => p.task.id)).toEqual(["a", "b"]);
  });
  it("exclut faites, refusées, transmises, abandonnées, prises par un collègue ; garde celles prises par moi", () => {
    const ts = ["a", "b", "c", "d", "e", "f"].map((id) => task(id, { team: "jour" }));
    const c = input(ts, {
      isDone: (k) => k === "a@2026-11-23",
      outcome: (k) => ({ "b@2026-11-23": "declined", "c@2026-11-23": "handed", "d@2026-11-23": "abandoned" })[k],
      holder: (k) => ({ "e@2026-11-23": "autre", "f@2026-11-23": "me" })[k],
    });
    expect(pendingTasks(c, MON, "jour").map((p) => p.task.id)).toEqual(["f"]);
  });
  it("tâche partagée acceptée ou transmise acceptée : toujours comptée ; partagée en attente ou refusée : jamais", () => {
    const ts = [
      task("s", { shareStatus: "accepted", sharedBy: "Léa", team: "soir", time: "22:00" }),
      task("p", { shareStatus: "pending", sharedBy: "Léa" }),
      task("r", { shareStatus: "declined", sharedBy: "Léa" }),
      task("t", { transferOnly: true, ownerId: "x", time: "09:00" }),
      task("u", { transferOnly: true, ownerId: "x" }), // transmise mais pas acceptée pour cette journée
    ];
    expect(pendingTasks(input(ts, { transferIn: new Set(["t@2026-11-23"]) }), MON, "jour").map((p) => p.task.id).sort()).toEqual(["s", "t"]);
  });
  it("une tâche en pause ou d'un autre jour n'est pas comptée", () => {
    const ts = [task("a", { paused: true }), task("b", { days: [1] }), task("c", { date: "2026-11-24" })];
    expect(pendingTasks(input(ts), MON, "jour")).toEqual([]);
  });
});

describe("tâche transmise : visible seulement pour la journée acceptée", () => {
  const moved = task("m", { transferOnly: true, ownerId: "x" });
  it("absente du planning habituel, présente pour la journée acceptée", () => {
    expect(planForService([moved], MON)).toEqual([]);
    expect(planForService([moved], MON, new Set(["m@2026-11-24"]))).toEqual([]);
    expect(planForService([moved], MON, new Set(["m@2026-11-23"])).map((p) => p.task.id)).toEqual(["m"]);
  });
  it("ignore le filtre d'équipe de mon planning", () => {
    const soir = task("m", { transferOnly: true, ownerId: "x", team: "jour" });
    expect(visiblePlan([soir], MON, "S------", new Set(["m@2026-11-23"])).map((p) => p.task.id)).toEqual(["m"]);
  });
  it("applySharedMeta : ni à moi ni partagée = transmise", () => {
    const [a, b, c] = applySharedMeta([task("a", { ownerId: "me" }), task("b", { ownerId: "x" }), task("c", { ownerId: "x" })], [{ task_id: "c", owner_prenom: "Léa", status: "accepted" }], "me");
    expect(a!.transferOnly).toBeUndefined();
    expect(b!.transferOnly).toBe(true);
    expect(c).toMatchObject({ shareStatus: "accepted" });
    expect(c!.transferOnly).toBeUndefined();
  });
});

describe("fin d'équipe et prochaine équipe", () => {
  it("Jour → équipe Soir le même jour ; Soir → équipe Jour le lendemain", () => {
    expect(nextShift("jour", MON)).toEqual({ team: "soir", date: MON });
    const n = nextShift("soir", MON);
    expect(n.team).toBe("jour");
    expect(n.date.toISOString().slice(0, 10)).toBe("2026-11-24");
  });
  it("fin d'équipe : relève pour le Jour, 2h pour le Soir ; début : 11h ou relève", () => {
    expect(teamEndExt("jour", 1080)).toBe(1080);
    expect(teamEndExt("soir", 1110)).toBe(1560);
    expect(teamStartExt("jour", 1110)).toBe(660);
    expect(teamStartExt("soir", 1080)).toBe(1080);
  });
  it("à l'heure de Paris, été comme hiver", () => {
    expect(teamEndAt("jour", 1110, MON).toISOString()).toBe("2026-11-23T17:30:00.000Z"); // 18h30 CET
    expect(teamEndAt("soir", 1110, MON).toISOString()).toBe("2026-11-24T01:00:00.000Z"); // 02h00 CET le lendemain
    const jul = parseDateKey("2026-07-13");
    expect(teamEndAt("jour", 1110, jul).toISOString()).toBe("2026-07-13T16:30:00.000Z"); // 18h30 CEST
    expect(teamEndAt("soir", 1110, jul).toISOString()).toBe("2026-07-14T00:00:00.000Z");
  });
  it("bilan envoyé X minutes avant la fin", () => {
    expect(bilanAt("jour", 1110, MON, 15).toISOString()).toBe("2026-11-23T17:15:00.000Z");
    expect(bilanAt("soir", 1110, MON, 0).toISOString()).toBe("2026-11-24T01:00:00.000Z");
  });
  it("nuit du passage à l'heure d'hiver (25 octobre) : la fin du Soir est 02h00 heure de Paris", () => {
    // 2026-10-24 est un samedi de service ; la nuit du 24 au 25 a 25 heures : 02h00 CET = 01h00 UTC
    expect(teamEndAt("soir", 1110, parseDateKey("2026-10-24")).toISOString()).toBe("2026-10-25T01:00:00.000Z");
  });
});

describe("statuts et historique", () => {
  it("fait > issue > non faite (fin d'équipe passée) > à faire", () => {
    expect(historyStatus({ done: true, over: true })).toBe("done");
    expect(historyStatus({ done: false, outcome: { status: "abandoned" }, over: true })).toBe("abandoned");
    expect(historyStatus({ done: false, over: true })).toBe("missed");
    expect(historyStatus({ done: false, over: false })).toBe("todo");
  });
  it("la journée est finie à la relève pour le Jour, à 2h pour le Soir (ou planning absent)", () => {
    const at = (iso: string) => new Date(iso);
    expect(shiftOver(at("2026-11-23T17:29:00Z"), MON, "J------", 1110)).toBe(false);
    expect(shiftOver(at("2026-11-23T17:30:00Z"), MON, "J------", 1110)).toBe(true);
    expect(shiftOver(at("2026-11-23T17:30:00Z"), MON, "S------", 1110)).toBe(false);
    expect(shiftOver(at("2026-11-24T01:00:00Z"), MON, null, 1110)).toBe(true);
  });
  it("les 8 statuts ont un libellé français court", () => {
    expect(Object.values(OCC_LABEL)).toEqual(["À faire", "Vue", "Reportée", "Faite", "Refusée", "Transmise", "Abandonnée", "Non faite"]);
  });
});

describe("correspondance base ↔ app", () => {
  it("réglage du bilan : 15 par défaut, borné", () => {
    expect(rowToSettings(null).bilanLead).toBe(15);
    expect(rowToSettings({ default_remind: 5, notify: true, handover_min: 1110, schedule: null, bilan_lead_min: 30 }).bilanLead).toBe(30);
    expect(rowToSettings({ default_remind: 5, notify: true, handover_min: 1110, schedule: null, bilan_lead_min: 999 }).bilanLead).toBe(15);
  });
  it("transmission", () => {
    expect(rowToTransfer({ id: "i", group_id: "g", task_id: "t", service_date: "2026-11-23", target_date: "2026-11-23", target_team: "soir", from_user: "a", from_prenom: "Léa", to_user: "b", to_prenom: "Tom", whole_team: true, message: "Coucou", status: "accepted" })).toMatchObject({ targetTeam: "soir", wholeTeam: true, message: "Coucou", status: "accepted" });
  });
  it("une tâche lue de la base garde son créateur", () => {
    const row = { id: "x", user_id: "u1", assigned_by: null, title: "T", category: "Autre", at_time: "12:00", days: [0], once_date: null, team: "both", remind: 0, repeat_every: null, end_time: null, until_done: true, paused: false, note: null } satisfies TaskRow;
    expect(rowToTask(row).ownerId).toBe("u1");
  });
});
