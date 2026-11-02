import { NextResponse } from "next/server";
import { z } from "zod";
import { askClarifyingQuestions } from "@/lib/ai/clarify";
import { fallbackQuestions, looksClear, type ClarifyResponse } from "@/lib/clarify-types";
import { isSameOrigin, jsonError } from "@/lib/http";
import { allowAction } from "@/lib/rate-limit";
import { ipHash } from "@/lib/request-ip";
import { getSecret } from "@/lib/secrets";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  prompt: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(3).max(1500)),
  hasImage: z.boolean().optional().default(false),
});

const NONE: ClarifyResponse = { needed: false, questions: [] };
// Appels peu coûteux (petit modèle), mais limités : 20 par heure et par personne, 3 000 par jour pour tout le site.
const PER_HOUR = 20;
const GLOBAL_PER_DAY = 3000;

/**
 * Assistant de questions : renvoie 2 à 3 questions à choix quand la demande est floue, sinon rien.
 * Toujours « sans blocage » : en cas d'erreur, de limite atteinte ou d'IA indisponible, la demande part telle quelle.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.", "forbidden");
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Requête invalide.", "invalid");
  const { prompt, hasImage } = parsed.data;

  // Demande détaillée : aucune question, aucun appel à l'IA.
  if (looksClear(prompt, hasImage)) return NextResponse.json(NONE);

  const demo = isDemoMode();
  const session = demo ? null : await getSession();
  const supabase = demo ? null : (session?.supabase ?? (await getServerSupabase()));

  const allowed = await allowAction(supabase, "clarify", {
    identity: session?.user.id ?? ipHash(request),
    ipHash: ipHash(request),
    max: PER_HOUR,
    windowSeconds: 3600,
    globalMax: GLOBAL_PER_DAY,
  });
  if (!allowed) return NextResponse.json(NONE);

  // En production sans Supabase, aucun appel payant : questions de repli uniquement.
  const apiKey = demo && process.env.NODE_ENV === "production" ? null : await getSecret("ANTHROPIC_API_KEY");
  const language = session?.profile.language ?? "fr";
  const ai = apiKey ? await askClarifyingQuestions({ apiKey, prompt, hasImage, language }) : null;
  if (ai) return NextResponse.json(ai);

  const questions = hasImage ? [] : fallbackQuestions(prompt);
  return NextResponse.json({ needed: questions.length > 0, questions } satisfies ClarifyResponse);
}
