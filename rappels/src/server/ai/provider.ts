// ============================================================================
//  SEUL fichier qui parle à un fournisseur d'IA (ici : Mistral).
//  Pour passer à Gemini ou autre : réécrire `streamChat` en gardant les mêmes
//  types d'entrée/sortie. Le reste de l'app ne change pas.
//  La clé MISTRAL_API_KEY n'est lue que côté serveur (jamais NEXT_PUBLIC_).
// ============================================================================
import { Mistral } from "@mistralai/mistralai";
import { MistralError } from "@mistralai/mistralai/models/errors";

export type ToolCallRequest = { id: string; name: string; arguments: string };

export type ProviderMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCallRequest[] }
  | { role: "tool"; name: string; toolCallId: string; content: string };

/** Définition d'un outil : schéma JSON des paramètres. */
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export type ProviderEvent = { type: "text"; text: string } | { type: "tool_calls"; calls: ToolCallRequest[] };

export type ProviderErrorKind = "rate_limit" | "quota" | "auth" | "unavailable" | "unknown";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_MODEL = "mistral-small-latest";

export function isProviderConfigured(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

// Le plan gratuit limite à ~1 requête/seconde : un message avec outil fait 2 appels d'affilée.
// On espace donc les appels (file d'attente) et on réessaie un 429 jusqu'à 2 fois.
// (Les délais sont réglables par variables d'env, uniquement utile pour les tests.)
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let nextSlot = 0;
async function pace() {
  const gap = Number(process.env.MISTRAL_MIN_GAP_MS ?? 1100);
  const slot = Math.max(Date.now(), nextSlot);
  nextSlot = slot + gap;
  if (slot > Date.now()) await sleep(slot - Date.now());
}

async function openStream(request: Parameters<Mistral["chat"]["stream"]>[0]) {
  const base = Number(process.env.MISTRAL_RETRY_BASE_MS ?? 1500);
  for (let attempt = 0; ; attempt++) {
    await pace();
    try {
      return await getClient().chat.stream(request);
    } catch (err) {
      if (!(err instanceof MistralError) || err.statusCode !== 429 || attempt >= 2) throw err;
      const retryAfter = Number(err.headers?.get("retry-after"));
      await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 6000) : base * (attempt + 1));
    }
  }
}

let client: Mistral | undefined;
function getClient(): Mistral {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new ProviderError("auth", "MISTRAL_API_KEY manquante");
  client ??= new Mistral({ apiKey, timeoutMs: 25_000 });
  return client;
}

function toSdkMessage(m: ProviderMessage) {
  if (m.role === "assistant") {
    return {
      role: "assistant" as const,
      content: m.content,
      ...(m.toolCalls?.length
        ? { toolCalls: m.toolCalls.map((c, index) => ({ id: c.id, type: "function", index, function: { name: c.name, arguments: c.arguments } })) }
        : {}),
    };
  }
  return m;
}

function toProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof MistralError) {
    if (err.statusCode === 429) {
      // Le plan gratuit renvoie 429 pour « trop de requêtes » et parfois pour quota épuisé.
      const quota = /quota|exceeded|capacity/i.test(err.body ?? "") && !/rate/i.test(err.body ?? "");
      return new ProviderError(quota ? "quota" : "rate_limit", `Mistral 429: ${err.body?.slice(0, 200)}`);
    }
    if (err.statusCode === 401 || err.statusCode === 403) return new ProviderError("auth", `Mistral ${err.statusCode}`);
    if (err.statusCode >= 500) return new ProviderError("unavailable", `Mistral ${err.statusCode}`);
    return new ProviderError("unknown", `Mistral ${err.statusCode}: ${err.body?.slice(0, 200)}`);
  }
  // Erreurs réseau / timeout du SDK.
  return new ProviderError("unavailable", err instanceof Error ? err.message : "erreur réseau");
}

/** Un tour de chat en streaming : émet du texte au fil de l'eau, puis éventuellement des appels d'outils. */
export async function* streamChat(args: { messages: ProviderMessage[]; tools: ToolSpec[] }): AsyncGenerator<ProviderEvent> {
  const calls = new Map<number, ToolCallRequest>();
  try {
    const stream = await openStream({
      model: process.env.MISTRAL_MODEL || DEFAULT_MODEL,
      temperature: 0.2, // réponses stables, calculs délégués aux outils
      maxTokens: 700,
      messages: args.messages.map(toSdkMessage),
      tools: args.tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
      toolChoice: "auto",
    });

    for await (const event of stream) {
      const delta = event.data.choices[0]?.delta;
      if (!delta) continue;

      const content = delta.content;
      if (typeof content === "string" && content) yield { type: "text", text: content };
      else if (Array.isArray(content)) {
        for (const chunk of content) if (chunk.type === "text" && chunk.text) yield { type: "text", text: chunk.text };
      }

      for (const tc of delta.toolCalls ?? []) {
        const index = tc.index ?? calls.size;
        const prev = calls.get(index);
        const chunk = typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {});
        // Mistral envoie normalement l'appel d'un bloc ; si les arguments arrivent en morceaux
        // (morceau sans nom de fonction), on les concatène.
        const continuation = !!prev && !tc.function.name;
        calls.set(index, {
          id: tc.id ?? prev?.id ?? `call_${index}`,
          name: tc.function.name || prev?.name || "",
          arguments: continuation ? prev.arguments + chunk : chunk,
        });
      }
    }
  } catch (err) {
    throw toProviderError(err);
  }

  if (calls.size > 0) yield { type: "tool_calls", calls: [...calls.values()] };
}
