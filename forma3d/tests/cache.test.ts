import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI } from "@/lib/settings";

const getSecret = vi.fn();
vi.mock("@/lib/secrets", () => ({ getSecret: (...args: unknown[]) => getSecret(...args) }));

const { computeCacheKey, normalizeForCache, cacheLookup } = await import("@/lib/cache");
const { SAMPLE_DESIGNS } = await import("@/lib/design/samples");

const base = { prompt: "Un support de téléphone", answers: [], language: "fr", ai: DEFAULT_AI };

describe("cache des conceptions", () => {
  beforeEach(() => {
    getSecret.mockReset();
    getSecret.mockResolvedValue("sk-ant-test");
    delete process.env.CACHE_SECRET;
    delete process.env.SECRETS_ENCRYPTION_KEY;
  });

  it("donne la même clé pour une demande identique, à la casse, aux espaces et à la ponctuation finale près", async () => {
    const a = await computeCacheKey(base);
    const b = await computeCacheKey({ ...base, prompt: "  un   SUPPORT de téléphone !  " });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toBe(a);
  });

  it("change de clé dès que les réponses, la langue ou les réglages d'IA changent", async () => {
    const a = await computeCacheKey(base);
    expect(await computeCacheKey({ ...base, answers: [{ question: "Où ?", answer: "Dehors" }] })).not.toBe(a);
    expect(await computeCacheKey({ ...base, language: "en" })).not.toBe(a);
    expect(await computeCacheKey({ ...base, ai: { ...DEFAULT_AI, model: "claude-sonnet-5-5" } })).not.toBe(a);
    expect(await computeCacheKey({ ...base, ai: { ...DEFAULT_AI, systemPrompt: DEFAULT_AI.systemPrompt + " !" } })).not.toBe(a);
  });

  it("dépend d'un secret du serveur : sans lui (ou avec un autre), aucune clé calculable de l'extérieur", async () => {
    const a = await computeCacheKey(base);
    getSecret.mockResolvedValue("sk-ant-autre");
    expect(await computeCacheKey(base)).not.toBe(a);
    getSecret.mockResolvedValue(null);
    expect(await computeCacheKey(base)).toBeNull();
    process.env.CACHE_SECRET = "secret-explicite";
    expect(await computeCacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalise le texte", () => {
    expect(normalizeForCache("  Bonjour   Le  MONDE ?!")).toBe("bonjour le monde");
  });

  it("ne sert que des conceptions valides, et jamais d'erreur bloquante", async () => {
    const design = SAMPLE_DESIGNS[0].design;
    const rpc = vi.fn();
    const client = { rpc } as never;
    rpc.mockResolvedValueOnce({ data: { design, model: "claude-opus-5-5" }, error: null });
    expect((await cacheLookup(client, "a".repeat(64)))?.design.title).toBe(design.title);
    rpc.mockResolvedValueOnce({ data: { design: { title: "invalide" }, model: null }, error: null });
    expect(await cacheLookup(client, "a".repeat(64))).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "function does not exist" } });
    expect(await cacheLookup(client, "a".repeat(64))).toBeNull();
    rpc.mockRejectedValueOnce(new Error("réseau"));
    expect(await cacheLookup(client, "a".repeat(64))).toBeNull();
    expect(await cacheLookup(null, "a".repeat(64))).toBeNull();
    expect(await cacheLookup(client, null)).toBeNull();
  });
});
