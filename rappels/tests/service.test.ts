import { describe, expect, it } from "vitest";
import { dateKey, occurrenceAt, planForService, serviceDate, sortKey, weekdayIndex } from "@/lib/service";
import { SAMPLE_TASKS } from "@/lib/samples";

// 2026-11-24 est un mardi, 2026-11-23 un lundi (dates en heure locale, indépendant du fuseau).
const monday = new Date(2026, 10, 23);

describe("service de nuit 19h → 3h", () => {
  it("01h30 appartient au service de la veille", () => {
    expect(dateKey(serviceDate(new Date(2026, 10, 24, 1, 30)))).toBe("2026-11-23");
    expect(dateKey(serviceDate(new Date(2026, 10, 24, 2, 59)))).toBe("2026-11-23");
  });

  it("à partir de 03h00 on bascule sur le service du jour", () => {
    expect(dateKey(serviceDate(new Date(2026, 10, 24, 3, 0)))).toBe("2026-11-24");
    expect(dateKey(serviceDate(new Date(2026, 10, 24, 19, 0)))).toBe("2026-11-24");
  });

  it("une tâche à 01h30 du service de lundi sonne le mardi", () => {
    const at = occurrenceAt({ time: "01:30" }, monday);
    expect(dateKey(at)).toBe("2026-11-24");
    expect(at.getHours()).toBe(1);
    expect(at.getMinutes()).toBe(30);
  });

  it("une tâche à 23h reste le même jour", () => {
    expect(dateKey(occurrenceAt({ time: "23:00" }, monday))).toBe("2026-11-23");
  });

  it("trie 19h → 23h59 puis 00h → 02h55", () => {
    const times = ["02:30", "19:00", "00:30", "23:00", "21:00"];
    expect([...times].sort((a, b) => sortKey(a) - sortKey(b))).toEqual(["19:00", "21:00", "23:00", "00:30", "02:30"]);
  });

  it("planifie les exemples dans l'ordre du service", () => {
    expect(planForService(SAMPLE_TASKS, monday).map((p) => p.task.time)).toEqual(["19:00", "19:05", "21:00", "23:00", "00:30", "02:30"]);
  });

  it("la répétition suit le jour de service, pas le jour calendaire", () => {
    const task = { ...SAMPLE_TASKS[5]!, days: [0] }; // clôture 02h30, service du lundi uniquement
    expect(planForService([task], monday)).toHaveLength(1);
    expect(planForService([task], new Date(2026, 10, 24))).toHaveLength(0);
    expect(weekdayIndex(monday)).toBe(0);
  });
});
