import { MESSAGES_PER_HOUR, type ErrorCode, type StreamEvent } from "@/lib/assistant-types";
import { runAssistant } from "@/server/ai/assistant";
import { isProviderConfigured, ProviderError } from "@/server/ai/provider";
import { checkRateLimit } from "@/server/ai/rate-limit";
import { parseRequest } from "@/server/ai/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MESSAGES: Record<ErrorCode, string> = {
  rate_limit: "Trop de demandes, réessaie dans une minute.",
  quota: "L'assistant a atteint sa limite gratuite pour le moment. Réessaie plus tard.",
  auth: "L'assistant n'est pas configuré correctement. Préviens ton responsable.",
  unavailable: "L'assistant est indisponible pour l'instant. Réessaie dans un instant.",
  unknown: "Oups, un souci côté assistant. Réessaie.",
};

function json(status: number, code: string, message: string, headers: Record<string, string> = {}) {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, "bad_request", "Requête illisible.");
  }
  const parsed = parseRequest(body);
  if (!parsed) return json(400, "bad_request", "Message invalide.");

  if (!isProviderConfigured()) {
    return json(503, "not_configured", "L'assistant n'est pas encore activé (clé MISTRAL_API_KEY absente côté serveur).");
  }

  const rawId = request.headers.get("x-client-id");
  const clientId = rawId && /^[A-Za-z0-9-]{8,64}$/.test(rawId) ? rawId : null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(clientId, ip);
  if (!rate.ok) {
    return json(429, "local_rate_limit", `Tu as atteint ${MESSAGES_PER_HOUR} messages cette heure. Reviens dans ${Math.ceil(rate.retryAfterSec / 60)} min.`, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        for await (const ev of runAssistant(parsed.messages, parsed.context)) send(ev);
      } catch (err) {
        const kind: ErrorCode = err instanceof ProviderError ? err.kind : "unknown";
        // On journalise le type d'erreur, jamais le contenu des messages.
        console.error("[assistant]", kind, err instanceof Error ? err.message.slice(0, 200) : "");
        send({ type: "error", code: kind, message: MESSAGES[kind] });
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
