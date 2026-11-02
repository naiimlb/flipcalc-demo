import { describe, expect, it, vi } from "vitest";
import { consumeCredits, getMyCredits, refundCredits } from "@/lib/credits";
import { CreditSettingsSchema, DEFAULT_CREDITS } from "@/lib/settings";

const client = (result: { data?: unknown; error?: { message: string } | null }) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }) }) as never;

describe("crédits (sans paiement)", () => {
  it("consomme et renvoie l'identifiant du mouvement", async () => {
    const supabase = client({ data: 42 });
    expect(await consumeCredits(supabase, "design")).toEqual({ ok: true, ledgerId: 42 });
  });

  it("signale clairement des crédits épuisés", async () => {
    const supabase = client({ error: { message: "CREDITS_EXHAUSTED" } });
    expect(await consumeCredits(supabase, "variant")).toEqual({ ok: false, exhausted: true });
  });

  it("n'empêche rien tant que le script SQL n'est pas appliqué (fonction absente)", async () => {
    const supabase = client({ error: { message: "Could not find the function public.consume_credits" } });
    expect(await consumeCredits(supabase, "design")).toEqual({ ok: true, ledgerId: null });
  });

  it("administrateur ou action gratuite : rien à rembourser", async () => {
    const supabase = client({ data: null });
    const result = await consumeCredits(supabase, "design");
    expect(result).toEqual({ ok: true, ledgerId: null });
    await refundCredits(supabase, null);
    expect((supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledTimes(1);
  });

  it("lit le solde et masque le badge si les crédits ne sont pas activés", async () => {
    const ok = client({ data: { free: 20, bonus: 5, total: 25, allowance: 30, renews_at: "2026-12-01", costs: { design: 1 }, unlimited: false } });
    expect(await getMyCredits(ok)).toMatchObject({ total: 25, free: 20, bonus: 5, renewsAt: "2026-12-01" });
    expect(await getMyCredits(client({ error: { message: "function my_credits does not exist" } }))).toBeNull();
  });

  it("le service text-to-3D futur coûte plus qu'une conception simple, réglages bornés", () => {
    expect(DEFAULT_CREDITS.costs.model3d).toBeGreaterThan(DEFAULT_CREDITS.costs.design);
    expect(CreditSettingsSchema.safeParse({ monthlyFree: -1, costs: DEFAULT_CREDITS.costs }).success).toBe(false);
    expect(CreditSettingsSchema.safeParse({ monthlyFree: 50, costs: { design: 2, variant: 1, model3d: 10 } }).success).toBe(true);
  });
});
