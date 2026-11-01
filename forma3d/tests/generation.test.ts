import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { DEFAULT_AI } from "@/lib/settings";

const generateDesignWithClaude = vi.fn();
const getSecret = vi.fn();

vi.mock("@/lib/ai/claude", () => ({ generateDesignWithClaude: (...args: unknown[]) => generateDesignWithClaude(...args) }));
vi.mock("@/lib/secrets", () => ({ getSecret: (...args: unknown[]) => getSecret(...args) }));

const { generateDesign } = await import("@/lib/generation");

const failure = (unavailable: boolean) => ({
  ok: false as const,
  error: "erreur",
  detail: "Your credit balance is too low",
  raw: "",
  stopReason: null,
  usage: null,
  servedBy: null,
  unavailable,
});

describe("repli quand l'IA est indisponible", () => {
  beforeEach(() => {
    generateDesignWithClaude.mockReset();
    getSecret.mockReset();
    getSecret.mockResolvedValue("sk-ant-test-key");
  });

  it("sert le modèle d'exemple le plus proche si le crédit est épuisé", async () => {
    generateDesignWithClaude.mockResolvedValue(failure(true));
    const outcome = await generateDesign({ prompt: "ranger mes câbles", ai: DEFAULT_AI, allowDemo: true });
    expect(outcome.ok).toBe(true);
    expect(outcome.provider).toBe("demo");
    expect(outcome.design?.title).toBe(SAMPLE_DESIGNS[1].design.title);
    expect(outcome.design?.analysis.assumptions[0]).toContain("n'a pas pu répondre");
  });

  it("garde l'erreur quand le repli est désactivé", async () => {
    generateDesignWithClaude.mockResolvedValue(failure(true));
    const outcome = await generateDesign({ prompt: "ranger mes câbles", ai: DEFAULT_AI, allowDemo: false });
    expect(outcome.ok).toBe(false);
    expect(outcome.provider).toBe("claude");
  });

  it("n'utilise pas le repli pour une erreur ponctuelle (la demande peut être réessayée)", async () => {
    generateDesignWithClaude.mockResolvedValue(failure(false));
    const outcome = await generateDesign({ prompt: "ranger mes câbles", ai: DEFAULT_AI, allowDemo: true });
    expect(outcome.ok).toBe(false);
  });

  it("sans clé : modèle d'exemple, Claude n'est jamais appelé", async () => {
    getSecret.mockResolvedValue(null);
    const outcome = await generateDesign({ prompt: "un support de téléphone", ai: DEFAULT_AI, allowDemo: true });
    expect(outcome.ok).toBe(true);
    expect(outcome.provider).toBe("demo");
    expect(generateDesignWithClaude).not.toHaveBeenCalled();
  });
});
