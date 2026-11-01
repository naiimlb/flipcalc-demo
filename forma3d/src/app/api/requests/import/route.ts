import { NextResponse } from "next/server";
import { z } from "zod";
import { validateDesign } from "@/lib/design/schema";
import { isSameOrigin, jsonError } from "@/lib/http";
import { toRequestItem } from "@/lib/requests";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  prompt: z.string().trim().min(3).max(1500),
  design: z.unknown(),
  provider: z.string().max(40).nullish(),
  model: z.string().max(80).nullish(),
});

/** Enregistre dans le compte le résultat d'un essai fait avant l'inscription. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Requête invalide.");
  const validated = validateDesign(parsed.data.design);
  if (!validated.ok) return jsonError(400, "Conception invalide.");

  const { data, error } = await session.supabase
    .rpc("import_design", {
      p_prompt: parsed.data.prompt,
      p_design: validated.design,
      p_provider: parsed.data.provider ?? null,
      p_model: parsed.data.model ?? null,
    })
    .single();
  if (error || !data) {
    const quota = error?.message?.includes("QUOTA");
    return jsonError(quota ? 429 : 500, quota ? "Limite d'import atteinte pour aujourd'hui." : "Enregistrement impossible.");
  }
  return NextResponse.json({ request: toRequestItem(data as Parameters<typeof toRequestItem>[0]) });
}
