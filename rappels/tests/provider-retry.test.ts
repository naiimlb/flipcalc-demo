import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeMistralError extends Error {
  constructor(
    readonly statusCode: number,
    readonly body = "",
    readonly headers = new Headers(),
  ) {
    super(`HTTP ${statusCode}`);
  }
}
const stream = vi.fn();
vi.mock("@mistralai/mistralai/models/errors", () => ({ MistralError: FakeMistralError }));
vi.mock("@mistralai/mistralai", () => ({ Mistral: class { chat = { stream }; } }));

process.env.MISTRAL_API_KEY = "test";
process.env.MISTRAL_MIN_GAP_MS = "0";
process.env.MISTRAL_RETRY_BASE_MS = "1";
const { streamChat, ProviderError } = await import("@/server/ai/provider");

const chunks = (...texts: string[]) =>
  (async function* () {
    for (const t of texts) yield { data: { choices: [{ delta: { content: t } }] } };
  })();
/** Renvoie les événements, ou l'erreur levée (sans rejet de promesse pour rester lisible). */
const collect = async (): Promise<{ events: unknown[]; error?: { kind?: string } }> => {
  const events: unknown[] = [];
  try {
    for await (const e of streamChat({ messages: [{ role: "user", content: "x" }], tools: [] })) events.push(e);
    return { events };
  } catch (error) {
    return { events, error: error as { kind?: string } };
  }
};

describe("provider Mistral : erreurs 429", () => {
  beforeEach(() => {
    stream.mockReset();
  });

  it("réessaie après un 429 puis réussit", async () => {
    stream
      .mockImplementationOnce(async () => {
        throw new FakeMistralError(429, '{"message":"Rate limit exceeded"}');
      })
      .mockResolvedValueOnce(chunks("ok"));
    expect(await collect()).toEqual({ events: [{ type: "text", text: "ok" }] });
    expect(stream.mock.calls.length).toBe(2);
  });

  it("abandonne après 3 essais avec une erreur rate_limit", async () => {
    stream.mockImplementation(async () => {
      throw new FakeMistralError(429, '{"message":"Rate limit exceeded"}');
    });
    const { error } = await collect();
    expect(error).toBeInstanceOf(ProviderError);
    expect(error?.kind).toBe("rate_limit");
    expect(stream.mock.calls.length).toBe(3);
  });

  it("ne réessaie pas une erreur d'authentification", async () => {
    stream.mockImplementation(async () => {
      throw new FakeMistralError(401);
    });
    const { error } = await collect();
    expect(error).toBeInstanceOf(ProviderError);
    expect(error?.kind).toBe("auth");
    expect(stream.mock.calls.length).toBe(1);
  });
});
