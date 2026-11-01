import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDesign } from "@/lib/generation";
import { isSameOrigin, jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { AiSettingsSchema } from "@/lib/settings";
import { getAiSettings } from "@/lib/settings.server";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  prompt: z.string().trim().min(3).max(1500),
  systemPrompt: AiSettingsSchema.shape.systemPrompt,
  model: AiSettingsSchema.shape.model,
  effort: AiSettingsSchema.shape.effort,
});

/** Bouton « Tester » de /admin/ia : exécute le prompt (brouillon) sans rien enregistrer. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.");
  const session = await getSession();
  if (!session || session.role !== "admin") return jsonError(403, "Réservé aux administrateurs.");

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.");

  const saved = await getAiSettings();
  const outcome = await generateDesign({
    prompt: parsed.data.prompt,
    ai: { ...saved, systemPrompt: parsed.data.systemPrompt, model: parsed.data.model, effort: parsed.data.effort },
    allowDemo: false,
  });
  await logEvent(outcome.ok ? "info" : "warn", "admin:test-prompt", outcome.ok ? "Test réussi." : outcome.detail ?? "Test échoué.", {
    details: { model: outcome.model, durationMs: outcome.durationMs, usage: outcome.usage, validationErrors: outcome.validationErrors },
    userId: session.user.id,
  });
  return NextResponse.json(outcome);
}
