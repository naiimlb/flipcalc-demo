import { describe, expect, it } from "vitest";
import { sampleTasks } from "@/lib/samples";
import {
  dateKey,
  dayPlanFor,
  isOutsideService,
  isOutsideTeamRange,
  isServiceLive,
  occurrenceAt,
  parisInstant,
  planForService,
  reminderAt,
  serviceDate,
  sortKey,
  visiblePlan,
  weekdayIndex,
} from "@/lib/service";
import type { Task } from "@/lib/types";

// Les instants sont donnés en UTC ; à Paris : UTC+1 l'hiver (CET), UTC+2 l'été (CEST).
const utc = (iso: string) => new Date(iso);
const monday = new Date(Date.UTC(2026, 10, 23)); // lundi 23 novembre 2026
const task = (extra: Partial<Task>): Task => ({ id: "x", title: "T", category: "Caisse", time: "12:00", days: [0, 1, 2, 3, 4, 5, 6], team: "both", remind: 0, ...extra });

describe("journée de service 11h → 2h (Europe/Paris)", () => {
  it("01h30 appartient à la journée de la veille", () => {
    expect(dateKey(serviceDate(utc("2026-11-24T00:30:00Z")))).toBe("2026-11-23"); // mardi 01h30 Paris
    expect(dateKey(serviceDate(utc("2026-11-24T00:59:00Z")))).toBe("2026-11-23"); // 01h59
  });

  it("à partir de 02h00 on bascule sur la journée du jour", () => {
    expect(dateKey(serviceDate(utc("2026-11-24T01:00:00Z")))).toBe("2026-11-24"); // 02h00
    expect(dateKey(serviceDate(utc("2026-11-24T10:00:00Z")))).toBe("2026-11-24"); // 11h00
  });

  it("le service est « en cours » de 11h à 2h seulement", () => {
    expect(isServiceLive(utc("2026-11-24T09:59:00Z"))).toBe(false); // 10h59
    expect(isServiceLive(utc("2026-11-24T10:00:00Z"))).toBe(true); // 11h00
    expect(isServiceLive(utc("2026-11-24T00:59:00Z"))).toBe(true); // 01h59
    expect(isServiceLive(utc("2026-11-24T01:00:00Z"))).toBe(false); // 02h00
  });

  it("le résultat ne dépend pas du fuseau du téléphone (calcul à l'heure de Paris)", () => {
    // 23h30 UTC le 23 = 00h30 à Paris le 24 : encore la journée du lundi 23.
    expect(dateKey(serviceDate(utc("2026-11-23T23:30:00Z")))).toBe("2026-11-23");
  });

  it("une tâche à 01h30 de la journée du lundi sonne mardi à 01h30 (heure de Paris)", () => {
    const at = occurrenceAt({ time: "01:30" }, monday);
    expect(at.toISOString()).toBe("2026-11-24T00:30:00.000Z");
  });

  it("une tâche à 23h30 reste le même jour ; 10h50 précède l'ouverture du même jour", () => {
    expect(occurrenceAt({ time: "23:30" }, monday).toISOString()).toBe("2026-11-23T22:30:00.000Z");
    expect(occurrenceAt({ time: "10:50" }, monday).toISOString()).toBe("2026-11-23T09:50:00.000Z");
  });

  it("trie 10h50 → 23h59 puis 00h00 → 01h55", () => {
    const times = ["01:30", "10:50", "00:30", "23:00", "14:00"];
    expect([...times].sort((a, b) => sortKey(a) - sortKey(b))).toEqual(["10:50", "14:00", "23:00", "00:30", "01:30"]);
  });

  it("répétition : suit le jour de service, pas le jour calendaire", () => {
    const closing = task({ time: "01:30", days: [0] }); // clôture, journée du lundi seulement
    expect(planForService([closing], monday)).toHaveLength(1);
    expect(planForService([closing], new Date(Date.UTC(2026, 10, 24)))).toHaveLength(0);
    expect(weekdayIndex(monday)).toBe(0);
  });
});

describe("heure d'été / heure d'hiver", () => {
  it("passage à l'heure d'été (dimanche 29 mars 2026, 02h → 03h)", () => {
    const sat = new Date(Date.UTC(2026, 2, 28));
    const sun = new Date(Date.UTC(2026, 2, 29));
    expect(occurrenceAt({ time: "01:30" }, sat).toISOString()).toBe("2026-03-29T00:30:00.000Z"); // 01h30 CET (+1)
    expect(occurrenceAt({ time: "11:00" }, sun).toISOString()).toBe("2026-03-29T09:00:00.000Z"); // 11h00 CEST (+2)
    expect(occurrenceAt({ time: "01:30" }, sun).toISOString()).toBe("2026-03-29T23:30:00.000Z"); // lundi 01h30 CEST
  });

  it("passage à l'heure d'hiver (dimanche 25 octobre 2026, 03h → 02h)", () => {
    const sat = new Date(Date.UTC(2026, 9, 24));
    const sun = new Date(Date.UTC(2026, 9, 25));
    expect(occurrenceAt({ time: "01:30" }, sat).toISOString()).toBe("2026-10-24T23:30:00.000Z"); // 01h30 CEST (+2)
    expect(occurrenceAt({ time: "11:00" }, sun).toISOString()).toBe("2026-10-25T10:00:00.000Z"); // 11h00 CET (+1)
  });

  it("le rappel part bien à la bonne heure y compris après minuit", () => {
    const closing = planForService([task({ time: "01:30", remind: 15 })], new Date(Date.UTC(2026, 9, 24)))[0]!;
    expect(reminderAt(closing).toISOString()).toBe("2026-10-24T23:15:00.000Z"); // 01h15 Paris, nuit du 24 au 25 octobre
  });

  it("parisInstant convertit une heure murale de Paris en instant", () => {
    expect(new Date(parisInstant(2026, 7, 1, 12, 0)).toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(new Date(parisInstant(2026, 12, 1, 12, 0)).toISOString()).toBe("2026-12-01T11:00:00.000Z");
  });
});

describe("équipes Jour / Soir et planning", () => {
  const tasks = [task({ id: "j", team: "jour", time: "14:00" }), task({ id: "s", team: "soir", time: "20:30" }), task({ id: "b", team: "both", time: "12:00" })];

  it("planning : lit la lettre du jour de service", () => {
    expect(dayPlanFor("JSRJSR-", monday)).toBe("J");
    expect(dayPlanFor("JSRJSR-", new Date(Date.UTC(2026, 10, 24)))).toBe("S");
    expect(dayPlanFor("JSRJSR-", new Date(Date.UTC(2026, 10, 29)))).toBeNull(); // dimanche : « - »
    expect(dayPlanFor(null, monday)).toBeNull();
  });

  it("montre uniquement les tâches de l'équipe du jour", () => {
    expect(visiblePlan(tasks, monday, "J------").map((p) => p.task.id)).toEqual(["b", "j"]);
    expect(visiblePlan(tasks, monday, "S------").map((p) => p.task.id)).toEqual(["b", "s"]);
  });

  it("jour de repos : aucune tâche ; planning non indiqué : toutes", () => {
    expect(visiblePlan(tasks, monday, "R------")).toHaveLength(0);
    expect(visiblePlan(tasks, monday, null)).toHaveLength(3);
    expect(visiblePlan(tasks, monday, "-------")).toHaveLength(3);
  });

  it("avertit quand l'heure sort de la plage de l'équipe (relève 18h30)", () => {
    expect(isOutsideTeamRange("14:00", "jour", 1110)).toBe(false);
    expect(isOutsideTeamRange("10:50", "jour", 1110)).toBe(false); // ouverture de caisse
    expect(isOutsideTeamRange("19:00", "jour", 1110)).toBe(true);
    expect(isOutsideTeamRange("18:30", "jour", 1110)).toBe(false);
    expect(isOutsideTeamRange("18:30", "soir", 1110)).toBe(false);
    expect(isOutsideTeamRange("18:00", "soir", 1110)).toBe(true);
    expect(isOutsideTeamRange("01:30", "soir", 1110)).toBe(false);
    expect(isOutsideTeamRange("01:30", "jour", 1110)).toBe(true);
    expect(isOutsideTeamRange("22:00", "both", 1110)).toBe(false);
    expect(isOutsideTeamRange("18:10", "soir", 1080)).toBe(false); // relève à 18h00
  });

  it("repère les anciennes tâches hors des horaires (entre 02h et 10h30)", () => {
    expect(isOutsideService("02:30")).toBe(true);
    expect(isOutsideService("10:29")).toBe(true);
    expect(isOutsideService("10:30")).toBe(false);
    expect(isOutsideService("01:55")).toBe(false);
  });
});

describe("tâches d'exemple", () => {
  const hm = (ts: Task[]) => Object.fromEntries(ts.map((t) => [`${t.team}:${t.title}`, t.time]));

  it("équipe jour et équipe soir, avec la relève à 18h30 (défaut)", () => {
    const e = hm(sampleTasks(1110));
    expect(e["jour:Ouvrir la caisse + fond de caisse"]).toBe("10:50");
    expect(e["jour:Mise en place comptoir"]).toBe("11:00");
    expect(e["jour:Réappro sauces et gobelets"]).toBe("14:00");
    expect(e["jour:Nettoyage comptoir"]).toBe("16:30");
    expect(e["jour:Transmission à l'équipe du soir"]).toBe("18:15"); // relève − 15 min
    expect(e["soir:Vérifier le fond de caisse après relève"]).toBe("18:35"); // relève + 5 min
    expect(e["soir:Réappro sauces et gobelets"]).toBe("20:30");
    expect(e["soir:Nettoyage comptoir"]).toBe("22:30");
    expect(e["soir:Vérif frigo boissons"]).toBe("00:30");
    expect(e["soir:Clôture caisse"]).toBe("01:30");
  });

  it("s'adaptent à une relève à 18h00", () => {
    const e = hm(sampleTasks(1080));
    expect(e["jour:Transmission à l'équipe du soir"]).toBe("17:45");
    expect(e["soir:Vérifier le fond de caisse après relève"]).toBe("18:05");
  });

  it("toutes les exemples sont dans la plage de leur équipe", () => {
    for (const t of sampleTasks(1110)) expect(isOutsideTeamRange(t.time, t.team, 1110)).toBe(false);
    for (const t of sampleTasks(1080)) expect(isOutsideTeamRange(t.time, t.team, 1080)).toBe(false);
  });
});
