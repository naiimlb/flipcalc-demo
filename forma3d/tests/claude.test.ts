/* eslint-disable @typescript-eslint/no-explicit-any -- accès aux paramètres du mock */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";

const mocks = vi.hoisted(() => {
  class FakeAPIError extends Error {
    status?: number;
  }
  class AuthenticationError extends FakeAPIError {}
  class PermissionDeniedError extends FakeAPIError {}
  class NotFoundError extends FakeAPIError {}
  class BadRequestError extends FakeAPIError {}
  class RateLimitError extends FakeAPIError {}
  class APIConnectionError extends FakeAPIError {}
  const stream = vi.fn();
  class FakeAnthropic {
    static APIError = FakeAPIError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static NotFoundError = NotFoundError;
    static BadRequestError = BadRequestError;
    static RateLimitError = RateLimitError;
    static APIConnectionError = APIConnectionError;
    beta = { messages: { stream: (params: unknown) => stream(params) } };
  }
  return { FakeAnthropic, stream, BadRequestError, AuthenticationError, RateLimitError };
});

vi.mock("@anthropic-ai/sdk", () => ({ default: mocks.FakeAnthropic }));

const { generateDesignWithClaude, isProviderUnavailable } = await import("@/lib/ai/claude");

const input = {
  apiKey: "sk-ant-test",
  systemPrompt: "Tu es un ingénieur.",
  model: "claude-opus-5-5",
  effort: "medium" as const,
  maxTokens: 32000,
  prompt: "un support de téléphone",
};

const reply = (text: string, stop = "end_turn") => ({
  finalMessage: async () => ({
    content: [{ type: "text", text }],
    usage: { input_tokens: 100, output_tokens: 200 },
    stop_reason: stop,
    model: "claude-opus-5-5",
  }),
});

describe("appel à Claude", () => {
  beforeEach(() => mocks.stream.mockReset());

  it("n'impose pas de sortie contrainte (grammaire trop lourde) et décrit le schéma dans le prompt", async () => {
    mocks.stream.mockReturnValue(reply(JSON.stringify(SAMPLE_DESIGNS[0].design)));
    const result = await generateDesignWithClaude(input);
    expect(result.ok).toBe(true);
    const params = mocks.stream.mock.calls[0][0] as Record<string, any>;
    expect(params.output_config).toEqual({ effort: "medium" });
    expect(JSON.stringify(params)).not.toContain("json_schema");
    const systemText = params.system.map((b: { text: string }) => b.text).join("\n");
    expect(systemText).toContain("Tu es un ingénieur.");
    expect(systemText).toContain("materiaux_conseilles");
    expect(params.thinking).toEqual({ type: "adaptive" });
  });

  it("diffuse le texte au fur et à mesure et signale une seconde tentative", async () => {
    const onText = vi.fn();
    const onRestart = vi.fn();
    const streamWith = (text: string) => {
      const handlers: Record<string, (d: string, snapshot: string) => void> = {};
      return {
        on: (event: string, handler: (d: string, snapshot: string) => void) => {
          handlers[event] = handler;
        },
        finalMessage: async () => {
          handlers.text?.("part", "snapshot-1");
          handlers.text?.("ie", "snapshot-2");
          return (await reply(text).finalMessage());
        },
      };
    };
    mocks.stream.mockReturnValueOnce(streamWith("pas du JSON")).mockReturnValueOnce(streamWith(JSON.stringify(SAMPLE_DESIGNS[0].design)));
    const result = await generateDesignWithClaude({ ...input, onText, onRestart });
    expect(result.ok).toBe(true);
    expect(onText).toHaveBeenCalledWith("snapshot-2");
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("accepte un JSON entouré de texte", async () => {
    mocks.stream.mockReturnValue(reply(`Voici la conception :\n${JSON.stringify(SAMPLE_DESIGNS[1].design)}\nBonne fabrication !`));
    expect((await generateDesignWithClaude(input)).ok).toBe(true);
  });

  it("refait un essai avec la liste des erreurs quand la réponse est illisible", async () => {
    mocks.stream.mockReturnValueOnce(reply("pas du JSON")).mockReturnValueOnce(reply(JSON.stringify(SAMPLE_DESIGNS[2].design)));
    const result = await generateDesignWithClaude(input);
    expect(result.ok).toBe(true);
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    const second = mocks.stream.mock.calls[1][0] as { messages: { content: { type: string; text?: string }[] }[] };
    expect(JSON.stringify(second.messages[0].content)).toContain("réponse précédente était invalide");
  });

  it("s'arrête après deux réponses invalides, avec le détail de validation", async () => {
    mocks.stream.mockReturnValue(reply(JSON.stringify({ title: "incomplet" })));
    const result = await generateDesignWithClaude(input);
    expect(result.ok).toBe(false);
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    if (!result.ok) expect(result.validationErrors?.length).toBeGreaterThan(0);
  });

  it("ne réessaie pas après un refus ni une réponse tronquée", async () => {
    mocks.stream.mockReturnValue(reply("{", "max_tokens"));
    const result = await generateDesignWithClaude(input);
    expect(result.ok).toBe(false);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });

  it("signale une IA indisponible pour une clé refusée, un crédit épuisé ou une requête refusée", async () => {
    const bad = new mocks.BadRequestError("The compiled grammar is too large");
    const auth = new mocks.AuthenticationError("invalid x-api-key");
    const credit = Object.assign(new mocks.BadRequestError("Your credit balance is too low"), { status: 400 });
    const rate = new mocks.RateLimitError("slow down");
    expect(isProviderUnavailable(bad)).toBe(true);
    expect(isProviderUnavailable(auth)).toBe(true);
    expect(isProviderUnavailable(credit)).toBe(true);
    expect(isProviderUnavailable(rate)).toBe(false);

    mocks.stream.mockReturnValue({
      finalMessage: async () => {
        throw auth;
      },
    });
    const result = await generateDesignWithClaude(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unavailable).toBe(true);
  });
});
