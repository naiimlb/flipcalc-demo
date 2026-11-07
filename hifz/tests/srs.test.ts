import { describe, expect, it } from "vitest";
import {
  addDays,
  buildSession,
  countIntroducedOn,
  createCard,
  DEFAULT_SRS_CONFIG,
  diffDays,
  isDayKey,
  isDue,
  schedule,
  toDayKey,
  type Grade,
  type SrsCard,
} from "@/lib/srs";

const D0 = "2026-03-01";

/** Applique une suite de notes, chacune le jour où le verset est dû (ou le jour donné). */
function run(card: SrsCard, steps: Array<Grade | [Grade, string]>): SrsCard {
  let c = card;
  let day = D0;
  for (const step of steps) {
    const [grade, at] = Array.isArray(step) ? step : [step, c.due ?? day];
    day = at;
    c = schedule(c, grade, day);
  }
  return c;
}

describe("dates", () => {
  it("ajoute des jours en franchissant mois, années et 29 février", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-10", -10)).toBe("2026-02-28");
  });

  it("compte les jours sans dépendre de l'heure d'été", () => {
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2); // passage à l'heure d'été en Europe
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(diffDays("2026-03-05", "2026-03-01")).toBe(-4);
  });

  it("valide le format des jours", () => {
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("26-2-1")).toBe(false);
    expect(() => addDays("n'importe quoi", 1)).toThrow(RangeError);
  });

  it("utilise le jour local de l'appareil", () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("création", () => {
  it("crée un verset nouveau, sans date de révision", () => {
    const c = createCard(2, 255, 1255);
    expect(c).toMatchObject({ key: "2:255", state: "new", ease: 2.5, interval: 0, reps: 0, due: null });
  });
});

describe("bonne réponse (« Je sais »)", () => {
  it("premier succès : révision demain, verset en cours", () => {
    const c = schedule(createCard(1, 1, 1), "good", D0);
    expect(c).toMatchObject({ state: "learning", interval: 1, reps: 1, ease: 2.6, due: "2026-03-02", introduced: D0 });
  });

  it("allonge les intervalles : 1, 3, 8, 23 jours, puis verset acquis", () => {
    const intervals: number[] = [];
    let c = createCard(1, 1, 1);
    for (let i = 0; i < 4; i++) {
      c = run(c, ["good"]);
      intervals.push(c.interval);
    }
    expect(intervals).toEqual([1, 3, 8, 23]);
    expect(c.state).toBe("mastered");
    expect(c.ease).toBe(2.9);
  });

  it("plafonne la facilité à 3,0 et l'intervalle à 180 jours", () => {
    const c = run(createCard(1, 1, 1), Array<Grade>(15).fill("good"));
    expect(c.ease).toBe(DEFAULT_SRS_CONFIG.maxEase);
    expect(c.interval).toBe(DEFAULT_SRS_CONFIG.maxInterval);
    expect(c.state).toBe("mastered");
  });

  it("ne modifie pas la fiche d'origine", () => {
    const c = createCard(1, 1, 1);
    const copy = structuredClone(c);
    schedule(c, "good", D0);
    expect(c).toEqual(copy);
  });
});

describe("hésitation (« Hésitant »)", () => {
  it("compte comme une réussite mais avec des intervalles plus courts", () => {
    const hard = run(createCard(1, 1, 1), ["hard", "hard", "hard"]);
    expect(hard.interval).toBe(3);
    expect(hard.reps).toBe(3);
    expect(hard.state).toBe("learning");

    const good = run(createCard(1, 1, 1), ["good", "good", "good"]);
    expect(hard.interval).toBeLessThan(good.interval);
  });

  it("baisse la facilité de 0,14", () => {
    const c = schedule(createCard(1, 1, 1), "hard", D0);
    expect(c.ease).toBe(2.36);
    expect(c.interval).toBe(1);
  });

  it("donne toujours un intervalle inférieur à « Je sais » pour la même fiche", () => {
    const base = run(createCard(1, 1, 1), ["good", "good", "good"]);
    const day = base.due!;
    expect(schedule(base, "hard", day).interval).toBeLessThan(schedule(base, "good", day).interval);
    expect(schedule(base, "hard", day).interval).toBeGreaterThan(base.interval);
  });
});

describe("échec (« À revoir »)", () => {
  it("renvoie à demain, remet la série à zéro et pénalise la facilité", () => {
    const learned = run(createCard(1, 1, 1), ["good", "good", "good", "good"]);
    expect(learned.state).toBe("mastered");
    const failed = schedule(learned, "again", learned.due!);
    expect(failed).toMatchObject({ state: "learning", interval: 1, reps: 0, lapses: 1 });
    expect(failed.ease).toBe(2.7);
    expect(failed.due).toBe(addDays(learned.due!, 1));
  });

  it("ne pénalise pas la toute première récitation d'un nouveau verset", () => {
    const c = schedule(createCard(1, 1, 1), "again", D0);
    expect(c).toMatchObject({ state: "learning", ease: 2.5, lapses: 0, interval: 1, due: "2026-03-02" });
    // Toujours pas de pénalité tant qu'il n'a jamais été réussi.
    expect(schedule(c, "again", c.due!).ease).toBe(2.5);
  });

  it("ne descend jamais sous la facilité plancher de 1,3", () => {
    const c = run(createCard(1, 1, 1), ["good", ...Array<Grade>(10).fill("again")]);
    expect(c.ease).toBe(DEFAULT_SRS_CONFIG.minEase);
    expect(c.lapses).toBe(10);
  });

  it("réapprend ensuite depuis le début", () => {
    const c = run(createCard(1, 1, 1), ["good", "good", "good", "again", "good", "good"]);
    expect(c.reps).toBe(2);
    expect(c.interval).toBe(3);
  });
});

describe("retards", () => {
  const learned = run(createCard(1, 1, 1), ["good", "good", "good"]); // intervalle 8, facilité 2,8

  it("crédite la moitié du retard quand le verset est encore su", () => {
    const late = addDays(learned.due!, 10);
    const onTime = schedule(learned, "good", learned.due!);
    const c = schedule(learned, "good", late);
    // (8 + 10 × 0,5) × 2,9 = 37,7 → 38 jours
    expect(c.interval).toBe(38);
    expect(c.interval).toBeGreaterThan(onTime.interval);
    expect(c.due).toBe(addDays(late, 38));
  });

  it("crédite un quart du retard pour une hésitation", () => {
    const c = schedule(learned, "hard", addDays(learned.due!, 8));
    // (8 + 8 × 0,25) × 1,2 = 12 jours
    expect(c.interval).toBe(12);
  });

  it("traite un échec en retard comme un échec normal", () => {
    const c = schedule(learned, "again", addDays(learned.due!, 30));
    expect(c).toMatchObject({ interval: 1, reps: 0, lapses: 1, state: "learning" });
  });

  it("reste dû tant qu'il n'est pas révisé", () => {
    expect(isDue(learned, learned.due!)).toBe(true);
    expect(isDue(learned, addDays(learned.due!, 40))).toBe(true);
    expect(isDue(learned, addDays(learned.due!, -1))).toBe(false);
  });
});

describe("révision en avance et même jour", () => {
  const learned = run(createCard(1, 1, 1), ["good", "good", "good"]); // intervalle 8

  it("une révision en avance ne raccourcit pas l'intervalle et n'augmente pas la série", () => {
    const early = addDays(learned.lastReview!, 2);
    const c = schedule(learned, "good", early);
    expect(c.interval).toBeGreaterThanOrEqual(learned.interval);
    expect(c.reps).toBe(learned.reps);
    expect(c.ease).toBe(learned.ease);
  });

  it("un échec en avance compte bien comme un échec", () => {
    const c = schedule(learned, "again", addDays(learned.lastReview!, 2));
    expect(c).toMatchObject({ interval: 1, reps: 0, lapses: 1 });
  });

  it("une deuxième note le même jour n'éloigne pas la révision", () => {
    const today = learned.due!;
    const once = schedule(learned, "good", today);
    expect(schedule(once, "good", today)).toBe(once);
    expect(schedule(once, "hard", today)).toBe(once);
  });

  it("« À revoir » le même jour après une réussite rapproche la révision", () => {
    const today = learned.due!;
    const c = schedule(schedule(learned, "good", today), "again", today);
    expect(c).toMatchObject({ interval: 1, due: addDays(today, 1), lapses: 1 });
  });

  it("deux « À revoir » le même jour ne pénalisent qu'une fois", () => {
    const today = learned.due!;
    const once = schedule(learned, "again", today);
    expect(schedule(once, "again", today)).toBe(once);
  });
});

describe("session du jour", () => {
  const today = "2026-04-10";
  const reviewDue = (rank: number, due: string): SrsCard => ({
    ...createCard(1, rank, rank),
    state: "learning",
    interval: 3,
    reps: 2,
    due,
    lastReview: addDays(due, -3),
    introduced: "2026-04-01",
  });

  const cards: SrsCard[] = [
    createCard(2, 3, 2003),
    createCard(2, 1, 2001),
    createCard(2, 2, 2002),
    reviewDue(5, today),
    reviewDue(2, "2026-04-01"), // 9 jours de retard
    reviewDue(9, "2026-04-11"), // demain : pas dans la session
    reviewDue(7, "2026-04-08"),
  ];

  it("prend les versets dus, dans l'ordre du mushaf, puis les nouveaux dans l'ordre du programme", () => {
    const s = buildSession(cards, { today, newLimit: 2, introducedToday: 0 });
    expect(s.reviews.map((c) => c.rank)).toEqual([2, 5, 7]);
    expect(s.fresh.map((c) => c.key)).toEqual(["2:1", "2:2"]);
  });

  it("déduit de la limite les nouveaux versets déjà commencés aujourd'hui", () => {
    expect(buildSession(cards, { today, newLimit: 2, introducedToday: 1 }).fresh).toHaveLength(1);
    expect(buildSession(cards, { today, newLimit: 2, introducedToday: 5 }).fresh).toHaveLength(0);
    expect(buildSession(cards, { today, newLimit: 0, introducedToday: 0 }).fresh).toHaveLength(0);
  });

  it("garde les plus en retard si un plafond de révisions est fixé", () => {
    const s = buildSession(cards, { today, newLimit: 0, introducedToday: 0, maxReviews: 2 });
    expect(s.reviews.map((c) => c.rank)).toEqual([2, 7]);
  });

  it("compte les versets commencés un jour donné", () => {
    const started = schedule(createCard(3, 1, 3001), "good", today);
    expect(countIntroducedOn([...cards, started], today)).toBe(1);
  });
});
