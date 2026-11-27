import { describe, expect, it } from "vitest";
import { clockLevel, plannerLevel } from "@/lib/testmode/diagnostics";
import { msToParisLocal, parisLocalToMs } from "@/lib/testmode/clock";
import { buildReport, TESTS } from "@/lib/testmode/runner";
import { testCalculator, testClock, testRepeated, testServiceDay } from "@/lib/testmode/suite-pure";
import type { Ctx } from "@/lib/testmode/types";

const ctx = { now: () => new Date("2026-11-23T17:15:10Z"), accelSeconds: 30, stepSeconds: 20 } as unknown as Ctx;
const failing = (o: { checks?: { ok: boolean; label: string; expected: string; got: string }[] }) => (o.checks ?? []).filter((c) => !c.ok).map((c) => `${c.label}: attendu ${c.expected}, obtenu ${c.got}`);

describe("mode test : tests automatiques purs (le même code que dans l'app)", () => {
  it("10. calculette de caisse", async () => {
    const r = await testCalculator();
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
    expect(r.detail).toContain("72,07 €");
  });
  it("11. journée de service : minuit, relève, heure d'été et d'hiver", async () => {
    const r = await testServiceDay(ctx);
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
  });
  it("5. rappel répété : un par créneau, jamais deux, jamais oublié", async () => {
    const r = await testRepeated(ctx);
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
  });
  it("13. simulateur d'horloge", async () => {
    const r = await testClock(ctx);
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
  });
  it("un test qui échoue est bien signalé KO avec attendu / obtenu", async () => {
    const { verdict, check } = await import("@/lib/testmode/types");
    const o = verdict([check("total", "72,07 €", "70,00 €")], "ok");
    expect(o.status).toBe("ko");
    expect(o.detail).toContain("attendu 72,07 €");
    expect(o.detail).toContain("obtenu 70,00 €");
  });
});

describe("mode test : diagnostic", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  it("planificateur : vert < 90 s, orange < 5 min, rouge au-delà ou jamais", () => {
    expect(plannerLevel("2026-11-23T11:59:30Z", now).level).toBe("ok");
    expect(plannerLevel("2026-11-23T11:57:30Z", now).level).toBe("warn");
    expect(plannerLevel("2026-11-23T11:50:00Z", now).level).toBe("ko");
    expect(plannerLevel(null, now).level).toBe("ko");
  });
  it("écart d'horloge : vert < 5 s, orange < 60 s, rouge au-delà", () => {
    expect(clockLevel(2000).level).toBe("ok");
    expect(clockLevel(-30_000).level).toBe("warn");
    expect(clockLevel(120_000).level).toBe("ko");
    expect(clockLevel(-120_000).detail).toContain("en avance");
  });
  it("simulateur d'horloge : heure de Paris ↔ instant, été comme hiver", () => {
    expect(new Date(parisLocalToMs("2026-11-23T18:15")!).toISOString()).toBe("2026-11-23T17:15:00.000Z");
    expect(new Date(parisLocalToMs("2026-07-13T18:15")!).toISOString()).toBe("2026-07-13T16:15:00.000Z");
    expect(msToParisLocal(Date.parse("2026-11-23T17:15:00Z"))).toBe("2026-11-23T18:15");
    expect(parisLocalToMs("n'importe quoi")).toBeNull();
  });
});

describe("mode test : liste et rapport", () => {
  it("les 13 tests existent, dans l'ordre", () => {
    expect([...new Set(TESTS.map((t) => t.n))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(TESTS.filter((t) => t.manual).map((t) => t.id)).toEqual(["click-closed", "click-background", "click-open"]);
    expect(TESTS.filter((t) => t.needsTestUser).map((t) => t.id)).toEqual(["share", "transfer"]);
  });
  it("le rapport texte liste OK / KO / non testé avec la durée et le détail des échecs", () => {
    const report = buildReport({
      who: "Sam",
      nowIso: "2026-11-23T17:15:00Z",
      diagnostics: [{ label: "Supabase", level: "ok", detail: "120 ms" }, { label: "Planificateur", level: "ko", detail: "jamais passé" }],
      results: [
        { id: "calc", status: "ok", detail: "ok", ms: 12 },
        { id: "detail", status: "ko", detail: "1 vérification en échec : statut", ms: 840, checks: [{ label: "statut", expected: "done", got: "todo", ok: false }] },
        { id: "share", status: "skip", detail: "Désigne d'abord un compte de test.", ms: 0 },
      ],
      anomalies: [{ at: "2026-11-23T17:00:00Z", prenom: "Léa", kind: "echec_envoi", detail: "HTTP 500", is_test: false }],
      clock: null,
    });
    expect(report).toContain("Bilan : 1 OK · 1 KO · 1 non testés");
    expect(report).toContain("[OK] 10. Calculette de caisse — 12 ms");
    expect(report).toContain("[KO] 3. Page détail : Fait, Plus tard, Refuser — 840 ms");
    expect(report).toContain("✗ statut | attendu : done | obtenu : todo");
    expect(report).toContain("[NON TESTÉ] 7. Partage");
    expect(report).toContain("[rouge] Planificateur : jamais passé");
    expect(report).toContain("Léa · echec_envoi · HTTP 500");
  });
});
