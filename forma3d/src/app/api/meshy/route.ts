import { NextResponse } from "next/server";
import { z } from "zod";
import { getMyCredits } from "@/lib/credits";
import { validateDesign } from "@/lib/design/schema";
import { isSameOrigin, jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { isMeshyKind, withStartedTask } from "@/lib/meshy-jobs";
import type { ModelAsset } from "@/lib/providers";
import {
  MESHY_COSTS,
  MESHY_CREDIT_ACTIONS,
  MESHY_KINDS,
  describeForMeshy,
  meshyBalance,
  meshyBody,
  meshyCreate,
  type MeshyKind,
} from "@/lib/providers/meshy";
import { REQUEST_COLUMNS, toRequestItem } from "@/lib/requests";
import { getSecret } from "@/lib/secrets";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Disponibilité des actions Meshy pour la personne connectée et leur coût en crédits Forma3D.
 * Masqué (available: false, sans erreur) tant que la clé MESHY_API_KEY ou le script SQL de la phase 3 manque.
 */
export async function GET() {
  if (isDemoMode()) return NextResponse.json({ available: false, reason: "demo" });
  if (!(await getPublicSettings()).features.meshy) return NextResponse.json({ available: false, reason: "disabled" });
  const session = await getSession();
  if (!session) return NextResponse.json({ available: false, reason: "guest" });
  const key = await getSecret("MESHY_API_KEY");
  if (!key) return NextResponse.json({ available: false, reason: "no_key" });
  const credits = await getMyCredits(session.supabase);
  // Le script SQL de la phase 3 ajoute les coûts Meshy au réglage des crédits.
  if (!credits || typeof credits.costs.meshy_retexture !== "number") return NextResponse.json({ available: false, reason: "sql" });
  const costs = Object.fromEntries(MESHY_KINDS.map((k) => [k, Number(credits.costs[MESHY_CREDIT_ACTIONS[k]] ?? 0)])) as Record<MeshyKind, number>;
  return NextResponse.json({ available: true, costs, balance: credits.unlimited ? null : credits.total, unlimited: credits.unlimited });
}

const BodySchema = z.object({
  requestId: z.string().regex(UUID),
  kind: z.string(),
  texturePrompt: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(600))
    .optional(),
  polycount: z.number().int().min(100).max(300_000).optional(),
  heightMm: z.number().min(1).max(5000).optional(),
});

/** Lance une action Meshy sur un projet, après vérification du solde (Forma3D et Meshy). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.");
  if (isDemoMode()) return jsonError(503, "Indisponible en mode démo.", "meshy_unavailable");
  if (!(await getPublicSettings()).features.meshy) return jsonError(503, "Fonction expérimentale désactivée.", "meshy_unavailable");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isMeshyKind(parsed.data.kind)) return jsonError(400, "Requête invalide.");
  const { requestId, texturePrompt, polycount, heightMm } = parsed.data;
  const kind = parsed.data.kind as MeshyKind;
  if (kind === "retexture" && (!texturePrompt || texturePrompt.length < 3)) return jsonError(400, "Décrivez la texture en quelques mots.");

  const key = await getSecret("MESHY_API_KEY");
  if (!key) return jsonError(503, "Service 3D Meshy non configuré.", "meshy_unavailable");

  const { data: row } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", requestId).eq("user_id", session.user.id).maybeSingle();
  if (!row || row.status !== "ready") return jsonError(404, "Projet introuvable ou pas encore terminé.");
  const validated = validateDesign(row.design);
  if (!validated.ok) return jsonError(400, "Conception invalide.");
  const asset = (row.model_asset as ModelAsset | null) ?? null;
  const meshyMesh = asset?.provider === "meshy" && asset.status === "succeeded" && asset.taskId ? asset : null;
  if (asset?.provider === "meshy" && (asset.status === "pending" || asset.status === "running") && kind !== "analyze") {
    return jsonError(409, "Une action Meshy est déjà en cours sur ce projet.", "meshy_busy");
  }

  // Source de l'action : le maillage Meshy du projet, sinon le modèle 3D enregistré (lien signé de courte durée).
  let input: { taskId?: string | null; modelUrl?: string | null } = {};
  if (kind === "refine") {
    if (!meshyMesh || meshyMesh.kind !== "preview") return jsonError(409, "Générez d'abord le modèle 3D Meshy.", "meshy_needs_preview");
    input = { taskId: meshyMesh.taskId };
  } else if (kind === "remesh" || kind === "resize") {
    if (!meshyMesh) return jsonError(409, "Générez d'abord le modèle 3D Meshy.", "meshy_needs_mesh");
    input = { taskId: meshyMesh.taskId };
  } else if (kind === "retexture" || kind === "repair" || kind === "analyze") {
    if (meshyMesh) input = { taskId: meshyMesh.taskId };
    else {
      if (!row.model_path) return jsonError(409, "Le modèle 3D est en cours d'enregistrement : réessayez dans un instant.", "model_not_ready");
      const { data: signed } = await session.supabase.storage.from("models").createSignedUrl(row.model_path, 900);
      if (!signed?.signedUrl) return jsonError(409, "Le modèle 3D est en cours d'enregistrement : réessayez dans un instant.", "model_not_ready");
      input = { modelUrl: signed.signedUrl };
    }
  }

  // Solde Forma3D (et fréquence) vérifié avant le lancement ; le débit a lieu à la réussite.
  const { data: check, error: checkError } = await session.supabase.rpc("meshy_start_check", { p_action: MESHY_CREDIT_ACTIONS[kind] });
  if (checkError) return jsonError(503, "Actions Meshy pas encore activées.", "meshy_sql_missing");
  const verdict = (check ?? {}) as { ok?: boolean; reason?: string; cost?: number };
  if (!verdict.ok) {
    if (verdict.reason === "credits") return jsonError(402, `Crédits insuffisants : cette action coûte ${verdict.cost ?? "?"} crédits.`, "credits_exhausted");
    return jsonError(429, "Trop d'actions Meshy en peu de temps : réessayez dans quelques minutes.", "meshy_rate");
  }
  // Solde du compte Meshy du site.
  const balance = await meshyBalance(key);
  if (balance !== null && balance < MESHY_COSTS[kind]) {
    return jsonError(503, "Le service 3D est momentanément indisponible (crédits Meshy du site épuisés).", "meshy_balance");
  }

  try {
    const body = meshyBody(kind, {
      ...input,
      prompt: describeForMeshy(validated.design),
      texturePrompt,
      polycount,
      heightMeters: heightMm ? heightMm / 1000 : validated.design.dimensions.height / 1000,
    });
    const taskId = await meshyCreate(kind, body, key);
    const next = withStartedTask(asset, kind, taskId, texturePrompt);
    const { error } = await session.supabase.from("design_requests").update({ model_asset: next, updated_at: new Date().toISOString() }).eq("id", requestId);
    if (error) throw error;
    return NextResponse.json({ request: toRequestItem({ ...row, model_asset: next }) });
  } catch (err) {
    await logEvent("warn", "provider:meshy", "Lancement de la tâche Meshy impossible.", { details: String(err), requestId, supabase: session.supabase });
    return jsonError(502, "Meshy n'a pas pu lancer l'action. Aucun crédit n'a été débité.", "meshy_failed");
  }
}
