import { NextResponse } from "next/server";
import { z } from "zod";
import { editDesignWithClaude } from "@/lib/ai/edit";
import { consumeCredits, getMyCredits, refundCredits } from "@/lib/credits";
import { applyEditLocally } from "@/lib/design/edit-local";
import { validateDesign } from "@/lib/design/schema";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getLocale } from "@/lib/i18n/server";
import { getSecret } from "@/lib/secrets";
import { getAiSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  design: z.unknown(),
  instruction: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(3, "Décrivez le changement en quelques mots.").max(300, "300 caractères maximum.")),
  selectedId: z.string().max(40).nullish(),
});

/**
 * « Modifie la pièce » : une consigne en une phrase appliquée à la scène.
 * Connecté : Claude (coût « ai_edit » en crédits, remboursé en cas d'échec). Sinon, ou sans clé : consignes simples locales.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.");
  const raw = await request.text();
  if (raw.length > 400_000) return jsonError(413, "Modèle trop volumineux.");
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError(400, "Requête invalide.");
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.");
  const validated = validateDesign(parsed.data.design);
  if (!validated.ok) return jsonError(400, "Conception invalide.");
  const design = validated.design;
  const selectedId = parsed.data.selectedId && design.model.parts.some((p) => p.id === parsed.data.selectedId) ? parsed.data.selectedId : null;
  const instruction = parsed.data.instruction;

  const local = () => {
    const result = applyEditLocally(design, instruction, selectedId);
    if (!result) {
      return jsonError(422, "Consigne non comprise. Exemples : « agrandis le trou de 2 mm », « arrondis les angles », « plus grand de 10 % ».", "not_understood");
    }
    const checked = validateDesign(result.design);
    if (!checked.ok) return jsonError(422, "Modification impossible sur cette pièce.", "invalid_result");
    return NextResponse.json({ design: checked.design, ids: result.ids, summary: result.summary, mode: "local" });
  };

  if (isDemoMode()) return local();
  const session = await getSession();
  const key = session ? await getSecret("ANTHROPIC_API_KEY") : null;
  if (!session || !key) return local();

  const consumed = await consumeCredits(session.supabase, "ai_edit");
  if (!consumed.ok) return jsonError(402, "Crédits épuisés : ils se renouvellent chaque mois.", "credits_exhausted");
  const ai = await getAiSettings();
  const result = await editDesignWithClaude({ apiKey: key, model: ai.model, design, instruction, selectedId, language: await getLocale() });
  if (!result.ok) {
    await refundCredits(session.supabase, consumed.ledgerId);
    // IA indisponible : on tente les consignes simples.
    if (result.unavailable) return local();
    return jsonError(422, result.error, "ai_failed");
  }
  const credits = await getMyCredits(session.supabase);
  return NextResponse.json({ design: result.design, ids: result.ids, summary: result.summary, mode: "ai", credits });
}
