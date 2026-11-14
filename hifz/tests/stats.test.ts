import { describe, expect, it } from "vitest";
import { createCard } from "@/lib/srs";
import { computeStreak, dailyActivity, regularity, stateTotals, surahProgress } from "@/lib/stats";

const today = "2026-05-20";

describe("série de jours", () => {
  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    expect(computeStreak(["2026-05-18", "2026-05-19", "2026-05-20"], today)).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it("garde la série d'hier tant que la journée n'est pas finie", () => {
    expect(computeStreak(["2026-05-18", "2026-05-19"], today)).toMatchObject({ current: 2, activeToday: false });
  });

  it("repart à zéro après un jour manqué et retient la meilleure série", () => {
    const s = computeStreak(["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-17"], today);
    expect(s.current).toBe(0);
    expect(s.best).toBe(4);
  });

  it("ignore les doublons et l'absence d'activité", () => {
    expect(computeStreak(["2026-05-20", "2026-05-20"], today).current).toBe(1);
    expect(computeStreak([], today)).toEqual({ current: 0, best: 0, activeToday: false });
  });
});

describe("régularité", () => {
  it("compte les révisions par jour sur la période", () => {
    const a = dailyActivity(["2026-05-20", "2026-05-20", "2026-05-18", "2026-04-01"], today, 7);
    expect(a).toHaveLength(7);
    expect(a[0]!.day).toBe("2026-05-14");
    expect(a.at(-1)).toEqual({ day: today, count: 2 });
    expect(a.find((d) => d.day === "2026-05-18")?.count).toBe(1);
    expect(regularity(a)).toBeCloseTo(2 / 7);
  });
});

describe("progression", () => {
  it("totalise les états et la progression par sourate", () => {
    const cards = [
      { ...createCard(2, 1, 1), state: "mastered" as const },
      { ...createCard(2, 2, 2), state: "learning" as const },
      createCard(2, 3, 3),
      { ...createCard(1, 1, 4), state: "mastered" as const },
    ];
    expect(stateTotals(cards)).toEqual({ new: 1, learning: 1, mastered: 2, total: 4 });
    const p = surahProgress(cards);
    expect(p.map((s) => s.surah)).toEqual([1, 2]);
    expect(p[1]).toMatchObject({ total: 3, mastered: 1 });
    expect(p[1]!.ratio).toBeCloseTo(1 / 3);
  });
});
