import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { IMAGE_MEDIA_TYPES } from "@/lib/ai/claude";
import { generateDesign } from "@/lib/generation";
import { isSameOrigin, jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { getModelProvider } from "@/lib/providers";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getSecret } from "@/lib/secrets";
import { DEFAULT_AI } from "@/lib/settings";
import { getAiSettings, getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

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

function localItem(
  body: z.infer<typeof BodySchema>,
  outcome: Awaited<ReturnType<typeof generateDesign>>,
  extra: Partial<RequestItem>,
): RequestItem {
  return {
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
    folderId: null,
    isFavorite: false,
    modelPath: null,
    source: "generated",
    ...extra,
  };
}

/** Empreinte salée de l'IP du visiteur (l'IP elle-même n'est jamais stockée). */
function guestHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnu";
  const salt = process.env.SECRETS_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL || "forma3d";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

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
    return NextResponse.json({ request: localItem(body, outcome, {}), raw: outcome.raw });
  }

  const { features } = await getPublicSettings();
  if (body.image && !features.imageUpload) {
    return jsonError(400, "L'ajout d'image est désactivé.", "image_disabled");
  }
  const session = await getSession();

  /* ---------- Essai sans compte : résultat renvoyé, non enregistré ---------- */
  if (!session) {
    if (!features.guestTrial || !features.newRequests) {
      return jsonError(401, "Connectez-vous pour créer une demande.", "unauthorized");
    }
    const anon = await getServerSupabase();
    const { data: allowed, error } = (await anon?.rpc("consume_guest_quota", { p_ip_hash: guestHash(request) })) ?? {
      data: false,
      error: null,
    };
    if (error) {
      console.error("Quota invité :", error.message);
      return jsonError(503, "Essai indisponible pour le moment : créez un compte pour continuer.", "guest_unavailable");
    }
    if (allowed !== true) {
      return jsonError(429, "Votre essai gratuit est utilisé : créez un compte (gratuit) pour continuer.", "guest_quota");
    }
    const outcome = await generateDesign({
      prompt: body.prompt,
      image: body.image,
      ai: await getAiSettings(),
      allowDemo: features.demoFallback,
    });
    return NextResponse.json({ request: localItem(body, outcome, { guest: true }) });
  }

  /* ---------- Utilisateur connecté : quota, génération, enregistrement ---------- */
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
      supabase: session.supabase,
    });
    return jsonError(500, "Impossible d'enregistrer la demande.", "db_error");
  }
  const requestId = created.id;

  const ai = await getAiSettings();
  const outcome = await generateDesign({
    prompt: body.prompt,
    image: body.image,
    ai,
    allowDemo: features.demoFallback,
    language: session.profile.language,
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
          supabase: session.supabase,
        });
      }
    }
  }

  // Écriture du résultat avec la session de l'utilisateur (fonction SQL : sa propre demande uniquement).
  const { error: completeError } = await session.supabase.rpc("complete_design_request", {
    p_id: requestId,
    p_status: outcome.ok ? "ready" : "error",
    p_title: outcome.design?.title ?? null,
    p_design: outcome.design,
    p_error: outcome.error,
    p_provider: outcome.provider,
    p_model: outcome.model,
    p_duration_ms: outcome.durationMs,
    p_model_asset: modelAsset,
    p_raw: outcome.raw?.slice(0, 500_000) ?? null,
    p_stop_reason: outcome.stopReason,
    p_usage: outcome.usage,
    p_validation_errors: outcome.validationErrors,
  });
  if (completeError) {
    await logEvent("error", "generate", "Écriture du résultat impossible.", {
      details: completeError,
      requestId,
      supabase: session.supabase,
    });
  }
  if (!outcome.ok) {
    await logEvent("error", "generate", outcome.detail ?? outcome.error ?? "Génération échouée.", {
      details: { validationErrors: outcome.validationErrors, stopReason: outcome.stopReason, model: outcome.model },
      requestId,
      supabase: session.supabase,
    });
  }

  const { data: row } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", requestId).single();
  if (!row) return jsonError(500, "Demande introuvable après génération.", "db_error");
  return NextResponse.json({
    request: toRequestItem(row),
    raw: session.role === "admin" && features.devMode ? outcome.raw : undefined,
  });
}
