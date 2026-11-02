import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { IMAGE_MEDIA_TYPES } from "@/lib/ai/claude";
import { cacheLookup, cacheStore, computeCacheKey, type CachedDesign } from "@/lib/cache";
import { AnswersSchema, composePrompt } from "@/lib/clarify-types";
import { progressChanged, progressFromText, type StreamProgress } from "@/lib/design/partial-json";
import { validateDesign, type Design } from "@/lib/design/schema";
import { VARIANT_IDS, type VariantId } from "@/lib/design/variants";
import { generateDesign, type GenerationOutcome } from "@/lib/generation";
import { isSameOrigin, jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { getModelProvider } from "@/lib/providers";
import { ipHash } from "@/lib/request-ip";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getSecret } from "@/lib/secrets";
import { DEFAULT_AI } from "@/lib/settings";
import { getAiSettings, getPublicSettings } from "@/lib/settings.server";
import { consumeCredits, getMyCredits, refundCredits } from "@/lib/credits";
import { intlLocale, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
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
  /** Réponses de l'assistant de questions (facultatif). */
  answers: AnswersSchema.optional().default([]),
  /** Nouvelle version d'une conception : objectif + conception de départ (revalidée ci-dessous). */
  variant: z.enum(VARIANT_IDS as [VariantId, ...VariantId[]]).optional(),
  base: z.unknown().optional(),
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
type Body = z.infer<typeof BodySchema>;

const QUOTA_MESSAGES: Record<string, [number, string]> = {
  QUOTA_HOURLY: [429, "Limite horaire atteinte : réessayez dans une heure."],
  QUOTA_DAILY: [429, "Limite quotidienne atteinte : réessayez demain."],
  ALREADY_RUNNING: [429, "Deux générations sont déjà en cours : attendez qu'elles se terminent."],
  REQUESTS_PAUSED: [503, "Les nouvelles demandes sont temporairement suspendues."],
  INVALID_PROMPT: [400, "Demande invalide (3 à 1 500 caractères)."],
  AUTH_REQUIRED: [401, "Connectez-vous pour créer une demande."],
};

/** Résultat d'un traitement : statut HTTP + corps JSON (le même, avec ou sans diffusion en continu). */
interface Result {
  status: number;
  body: unknown;
}
type Emit = (event: Record<string, unknown>) => void;

const ok = (body: unknown): Result => ({ status: 200, body });
const fail = (status: number, error: string, code?: string): Result => ({ status, body: { error, code } });

function localItem(body: Body, outcome: GenerationOutcome, extra: Partial<RequestItem>): RequestItem {
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

function cachedOutcome(cached: CachedDesign, started: number): GenerationOutcome {
  return {
    ok: true,
    design: cached.design,
    provider: "claude",
    model: cached.model,
    error: null,
    detail: null,
    raw: null,
    stopReason: null,
    usage: null,
    validationErrors: null,
    durationMs: Date.now() - started,
  };
}

/** Transforme le texte de l'IA en évènements d'avancement (au plus un toutes les 300 ms). */
function progressReporter(emit: Emit) {
  let last: StreamProgress | null = null;
  let lastAt = 0;
  return {
    onText(snapshot: string) {
      const now = Date.now();
      if (now - lastAt < 300) return;
      lastAt = now;
      const progress = progressFromText(snapshot);
      if (progress && progressChanged(last, progress)) {
        last = progress;
        emit({ t: "progress", progress });
      }
    },
    onRestart() {
      last = null;
      lastAt = 0;
      emit({ t: "progress", progress: { stage: "thinking", done: [] } satisfies StreamProgress });
    },
  };
}

async function run(request: Request, body: Body, emit: Emit, variant: { id: VariantId; base: Design } | null): Promise<Result> {
  const started = Date.now();
  const composed = composePrompt(body.prompt, body.answers);
  const reporter = progressReporter(emit);
  emit({ t: "progress", progress: { stage: "thinking", done: [] } satisfies StreamProgress });

  /* ---------- Mode démo (Supabase non configuré) : rien n'est sauvegardé ---------- */
  if (isDemoMode()) {
    // En production sans Supabase, pas d'appel payant : uniquement les modèles d'exemple.
    const allowClaude = process.env.NODE_ENV !== "production";
    const outcome = await generateDesign({
      prompt: composed,
      image: allowClaude ? body.image : null,
      ai: DEFAULT_AI,
      allowDemo: true,
      forceDemo: !allowClaude,
      variant,
      onText: reporter.onText,
      onRestart: reporter.onRestart,
    });
    return ok({ request: localItem(body, outcome, {}), raw: outcome.raw });
  }

  const { features } = await getPublicSettings();
  if (body.image && !features.imageUpload) {
    return fail(400, "L'ajout d'image est désactivé.", "image_disabled");
  }
  const session = await getSession();
  const ai = await getAiSettings();
  // Les réponses de l'IA suivent la langue choisie dans l'interface.
  const language = await getLocale();
  // Pas de cache pour les demandes avec photo.
  const cacheKey = body.image
    ? null
    : await computeCacheKey({
        prompt: body.prompt,
        answers: body.answers,
        language,
        ai,
        extra: variant ? `${variant.id}:${createHash("sha256").update(JSON.stringify(variant.base)).digest("hex")}` : undefined,
      });

  /* ---------- Essai sans compte : résultat renvoyé, non enregistré ---------- */
  if (!session) {
    if (!features.guestTrial || !features.newRequests) {
      return fail(401, "Connectez-vous pour créer une demande.", "unauthorized");
    }
    const anon = await getServerSupabase();

    // Demande déjà traitée : affichage instantané, sans IA donc sans consommer l'essai gratuit.
    const hit = await cacheLookup(anon, cacheKey);
    if (hit) return ok({ request: localItem(body, cachedOutcome(hit, started), { guest: true }), cached: true });

    const { data: allowed, error } = (await anon?.rpc("consume_guest_quota", { p_ip_hash: ipHash(request) })) ?? {
      data: false,
      error: null,
    };
    if (error) {
      console.error("Quota invité :", error.message);
      return fail(503, "Essai indisponible pour le moment : créez un compte pour continuer.", "guest_unavailable");
    }
    if (allowed !== true) {
      return fail(429, "Votre essai gratuit est utilisé : créez un compte (gratuit) pour continuer.", "guest_quota");
    }
    const outcome = await generateDesign({
      prompt: composed,
      image: body.image,
      ai,
      allowDemo: features.demoFallback,
      language,
      variant,
      onText: reporter.onText,
      onRestart: reporter.onRestart,
    });
    return ok({ request: localItem(body, outcome, { guest: true }) });
  }

  /* ---------- Utilisateur connecté : crédits, quota, génération, enregistrement ---------- */
  // Demande déjà traitée (même texte, mêmes réponses) : on réutilise la conception, sans IA et sans crédit.
  const hit = await cacheLookup(session.supabase, cacheKey);

  // Crédits (phase 5) : consommés avant l'appel à l'IA, remboursés si la génération échoue.
  let ledgerId: number | null = null;
  if (!hit) {
    const consumed = await consumeCredits(session.supabase, variant ? "variant" : "design");
    if (!consumed.ok) {
      const credits = await getMyCredits(session.supabase);
      const date = credits?.renewsAt ? new Date(credits.renewsAt).toLocaleDateString(intlLocale(language), { day: "numeric", month: "long" }) : "";
      return {
        status: 402,
        body: { error: translate(language, "credits.exhausted", { date }), code: "credits_exhausted", credits },
      };
    }
    ledgerId = consumed.ledgerId;
  }

  const { data: created, error: createError } = await session.supabase
    .rpc("create_design_request", { p_prompt: body.prompt, p_has_image: Boolean(body.image) })
    .single<{ id: string }>();
  if (createError || !created) {
    await refundCredits(session.supabase, ledgerId);
    const code = Object.keys(QUOTA_MESSAGES).find((k) => createError?.message?.includes(k));
    if (code) {
      const [status, message] = QUOTA_MESSAGES[code];
      return fail(status, message, code.toLowerCase());
    }
    await logEvent("error", "generate", "Création de la demande impossible.", {
      details: createError,
      userId: session.user.id,
      supabase: session.supabase,
    });
    return fail(500, "Impossible d'enregistrer la demande.", "db_error");
  }
  const requestId = created.id;

  const outcome = hit
    ? cachedOutcome(hit, started)
    : await generateDesign({
        prompt: composed,
        image: body.image,
        ai,
        allowDemo: features.demoFallback,
        language,
        variant,
        onText: reporter.onText,
        onRestart: reporter.onRestart,
      });
  emit({ t: "progress", progress: { stage: "saving", done: [] } satisfies StreamProgress });
  // Pas de crédit pour une génération échouée ou servie sans IA (modèle d'exemple, version calculée localement).
  if (!outcome.ok || outcome.provider !== "claude") await refundCredits(session.supabase, ledgerId);

  // Fournisseur 3D externe (expérimental) : lance la tâche, la suite se fait par sondage.
  let modelAsset: unknown = null;
  if (!hit && outcome.ok && outcome.design && ai.provider3d !== "primitives") {
    const provider = getModelProvider(ai.provider3d);
    const key = provider?.secretName ? await getSecret(provider.secretName) : null;
    // Service text-to-3D (futur) : plus coûteux en crédits qu'une conception simple.
    const meshCredits = provider && key ? await consumeCredits(session.supabase, "model3d", requestId) : null;
    if (provider && key && meshCredits?.ok) {
      try {
        modelAsset = await provider.start({ prompt: body.prompt, design: outcome.design, apiKey: key });
      } catch (err) {
        await refundCredits(session.supabase, meshCredits.ledgerId);
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
  } else if (outcome.ok && outcome.provider === "claude") {
    // Cette conception devient la source du cache pour les demandes identiques.
    await cacheStore(session.supabase, requestId, cacheKey);
  }
  if (!outcome.ok) {
    await logEvent("error", "generate", outcome.detail ?? outcome.error ?? "Génération échouée.", {
      details: { validationErrors: outcome.validationErrors, stopReason: outcome.stopReason, model: outcome.model },
      requestId,
      supabase: session.supabase,
    });
  }

  const { data: row } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", requestId).single();
  if (!row) return fail(500, "Demande introuvable après génération.", "db_error");
  return ok({
    request: toRequestItem(row),
    raw: session.role === "admin" && features.devMode ? outcome.raw : undefined,
    cached: hit ? true : undefined,
    credits: await getMyCredits(session.supabase),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.", "forbidden");

  let body: Body;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Requête invalide.", "invalid");
    body = parsed.data;
  } catch {
    return jsonError(400, "Corps JSON invalide.", "invalid");
  }

  // Version d'une conception : la conception de départ vient du navigateur, elle est revalidée et bornée.
  let variant: { id: VariantId; base: Design } | null = null;
  if (body.variant) {
    const raw = JSON.stringify(body.base ?? null);
    const validated = raw.length <= 200_000 ? validateDesign(body.base) : null;
    if (!validated?.ok) return jsonError(400, "Conception de départ invalide.", "invalid_base");
    variant = { id: body.variant, base: validated.design };
    body.image = null;
  }

  // Réponse classique (scripts, tests, anciens clients).
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
    const result = await run(request, body, () => {}, variant);
    return NextResponse.json(result.body, { status: result.status });
  }

  // Diffusion en continu : une ligne JSON par évènement, la dernière (« result ») contient la réponse finale.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false; // le navigateur est parti : la génération continue et sera enregistrée quand même
        }
      };
      const keepAlive = setInterval(() => send({ t: "ping" }), 8000);
      try {
        const result = await run(request, body, send, variant);
        send({ t: "result", status: result.status, body: result.body });
      } catch (err) {
        console.error("Génération :", err);
        send({ t: "result", status: 500, body: { error: "Erreur inattendue pendant la génération.", code: "internal" } });
      } finally {
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      }
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
