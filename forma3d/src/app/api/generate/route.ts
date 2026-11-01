import { NextResponse } from "next/server";
import { z } from "zod";
import { IMAGE_MEDIA_TYPES } from "@/lib/ai/claude";
import { generateDesign } from "@/lib/generation";
import { isSameOrigin, jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { getModelProvider } from "@/lib/providers";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getSecret } from "@/lib/secrets";
import { DEFAULT_AI, DEFAULT_FEATURES } from "@/lib/settings";
import { getAiSettings, getPublicSettings } from "@/lib/settings.server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGE_BASE64 = 2_000_000; // ≈ 1,5 Mo (le navigateur réduit l'image avant l'envoi)

const BodySchema = z.object({
  prompt: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(3, "Décrivez votre besoin en quelques mots.").max(1500, "1 500 caractères maximum.")),
  image: z
    .object({
      mediaType: z.enum(IMAGE_MEDIA_TYPES),
      data: z
        .string()
        .max(MAX_IMAGE_BASE64, "Image trop lourde.")
        .regex(/^[A-Za-z0-9+/]+=*$/, "Image invalide."),
    })
    .nullish(),
});

const QUOTA_MESSAGES: Record<string, [number, string]> = {
  QUOTA_HOURLY: [429, "Limite horaire atteinte : réessayez dans une heure."],
  QUOTA_DAILY: [429, "Limite quotidienne atteinte : réessayez demain."],
  ALREADY_RUNNING: [429, "Deux générations sont déjà en cours : attendez qu'elles se terminent."],
  REQUESTS_PAUSED: [503, "Les nouvelles demandes sont temporairement suspendues."],
  INVALID_PROMPT: [400, "Demande invalide (3 à 1 500 caractères)."],
  AUTH_REQUIRED: [401, "Connectez-vous pour créer une demande."],
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.", "forbidden");

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.", "invalid");
    body = parsed.data;
  } catch {
    return jsonError(400, "Corps JSON invalide.", "invalid");
  }

  /* ---------- Mode démo (Supabase non configuré) : rien n'est sauvegardé ---------- */
  if (isDemoMode()) {
    // En production sans Supabase, pas d'appel payant : uniquement les modèles d'exemple.
    const allowClaude = process.env.NODE_ENV !== "production";
    const outcome = await generateDesign({
      prompt: body.prompt,
      image: allowClaude ? body.image : null,
      ai: DEFAULT_AI,
      allowDemo: true,
      forceDemo: !allowClaude,
    });
    const item: RequestItem = {
      id: crypto.randomUUID(),
      prompt: body.prompt,
      status: outcome.ok ? "ready" : "error",
      title: outcome.design?.title ?? null,
      design: outcome.design,
      error: outcome.error,
      provider: outcome.provider,
      model: outcome.model,
      hasImage: Boolean(body.image),
      createdAt: new Date().toISOString(),
      durationMs: outcome.durationMs,
      asset: null,
    };
    return NextResponse.json({ request: item, raw: outcome.raw });
  }

  /* ---------- Mode normal ---------- */
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous pour créer une demande.", "unauthorized");
  const service = getServiceSupabase();
  if (!service) {
    await logEvent("error", "generate", "SUPABASE_SECRET_KEY manquante : impossible d'enregistrer le résultat.");
    return jsonError(503, "Le serveur n'est pas complètement configuré.", "misconfigured");
  }

  const { features } = await getPublicSettings();
  if (body.image && !features.imageUpload) {
    return jsonError(400, "L'ajout d'image est désactivé.", "image_disabled");
  }

  // Quotas, pause globale et insertion : atomiques côté base (fonction SQL).
  const { data: created, error: createError } = await session.supabase
    .rpc("create_design_request", { p_prompt: body.prompt, p_has_image: Boolean(body.image) })
    .single<{ id: string }>();
  if (createError || !created) {
    const code = Object.keys(QUOTA_MESSAGES).find((k) => createError?.message?.includes(k));
    if (code) {
      const [status, message] = QUOTA_MESSAGES[code];
      return jsonError(status, message, code.toLowerCase());
    }
    await logEvent("error", "generate", "Création de la demande impossible.", {
      details: createError,
      userId: session.user.id,
    });
    return jsonError(500, "Impossible d'enregistrer la demande.", "db_error");
  }
  const requestId = created.id;

  const ai = await getAiSettings();
  const outcome = await generateDesign({
    prompt: body.prompt,
    image: body.image,
    ai,
    allowDemo: features.demoFallback ?? DEFAULT_FEATURES.demoFallback,
  });

  // Fournisseur 3D externe (expérimental) : lance la tâche, la suite se fait par sondage.
  let modelAsset: unknown = null;
  if (outcome.ok && outcome.design && ai.provider3d !== "primitives") {
    const provider = getModelProvider(ai.provider3d);
    const key = provider?.secretName ? await getSecret(provider.secretName) : null;
    if (provider && key) {
      try {
        modelAsset = await provider.start({ prompt: body.prompt, design: outcome.design, apiKey: key });
      } catch (err) {
        await logEvent("warn", `provider:${provider.id}`, "Lancement du maillage impossible.", {
          details: String(err),
          requestId,
          userId: session.user.id,
        });
      }
    }
  }

  const { error: updateError } = await service
    .from("design_requests")
    .update({
      status: outcome.ok ? "ready" : "error",
      title: outcome.design?.title?.slice(0, 200) ?? null,
      design: outcome.design,
      error: outcome.error,
      provider: outcome.provider,
      model: outcome.model,
      model_asset: modelAsset,
      duration_ms: outcome.durationMs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateError) {
    await logEvent("error", "generate", "Écriture du résultat impossible.", {
      details: updateError,
      requestId,
      userId: session.user.id,
    });
  }

  await service.from("request_debug").upsert({
    request_id: requestId,
    raw_response: outcome.raw?.slice(0, 500_000) ?? null,
    stop_reason: outcome.stopReason,
    usage: outcome.usage,
    validation_errors: outcome.validationErrors,
  });

  if (!outcome.ok) {
    await logEvent("error", "generate", outcome.detail ?? outcome.error ?? "Génération échouée.", {
      details: { validationErrors: outcome.validationErrors, stopReason: outcome.stopReason, model: outcome.model },
      requestId,
      userId: session.user.id,
    });
  }

  const { data: row } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", requestId).single();
  if (!row) return jsonError(500, "Demande introuvable après génération.", "db_error");
  return NextResponse.json({
    request: toRequestItem(row),
    raw: session.role === "admin" && features.devMode ? outcome.raw : undefined,
  });
}
