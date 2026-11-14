import { describe, expect, it } from "vitest";
import { createCard } from "@/lib/srs";
import { currentItem, gradeCurrent, isFinished, startQueue } from "@/modules/hifz/session-queue";

const review = { ...createCard(1, 2, 2), state: "learning" as const, due: "2026-01-01" };
const fresh = createCard(1, 3, 3);

describe("file de la session", () => {
  it("présente les révisions puis les nouveaux versets", () => {
    const q = startQueue({ reviews: [review], fresh: [fresh] });
    expect(q.items.map((i) => [i.key, i.kind])).toEqual([
      ["1:2", "review"],
      ["1:3", "new"],
    ]);
    expect(currentItem(q)?.key).toBe("1:2");
  });

  it("repropose une seule fois un verset à revoir, sans le compter deux fois", () => {
    let q = startQueue({ reviews: [review], fresh: [fresh] });
    q = gradeCurrent(q, "again");
    q = gradeCurrent(q, "good");
    expect(currentItem(q)).toMatchObject({ key: "1:2", kind: "retry" });
    q = gradeCurrent(q, "again");
    expect(isFinished(q)).toBe(true);
    expect(q.results).toEqual({ good: 1, hard: 0, again: 1 });
  });

  it("ne fait rien une fois la session terminée", () => {
    const q = gradeCurrent(startQueue({ reviews: [], fresh: [] }), "good");
    expect(isFinished(q)).toBe(true);
    expect(q.results.good).toBe(0);
  });
});
