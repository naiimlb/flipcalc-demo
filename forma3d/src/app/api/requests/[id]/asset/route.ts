import { NextResponse } from "next/server";
import { getMyCredits } from "@/lib/credits";
import { jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { refreshMeshyAsset } from "@/lib/meshy-jobs";
import type { ModelAsset } from "@/lib/providers";
import { toRequestItem, REQUEST_COLUMNS } from "@/lib/requests";
import { getSecret } from "@/lib/secrets";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Copie du maillage terminé dans Supabase Storage : quelques secondes de plus.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sondage des tâches Meshy d'un projet (maillage, analyse) : met à jour, facture à la réussite et renvoie la demande. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return jsonError(400, "Identifiant invalide.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");

  // Sa propre demande uniquement (la RLS le garantit aussi).
  const { data: row } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", id).eq("user_id", session.user.id).maybeSingle();
  if (!row) return jsonError(404, "Demande introuvable.");

  const asset = row.model_asset as ModelAsset | null;
  const running = (s?: string) => s === "pending" || s === "running";
  if (!asset || asset.provider !== "meshy" || (!running(asset.status) && !running(asset.analysis?.status))) {
    return NextResponse.json({ request: toRequestItem(row) });
  }
  const key = await getSecret("MESHY_API_KEY");
  if (!key) return NextResponse.json({ request: toRequestItem(row) });

  try {
    const result = await refreshMeshyAsset({ asset, apiKey: key, supabase: session.supabase, requestId: id, userId: session.user.id });
    if (result.changed) {
      await session.supabase.from("design_requests").update({ model_asset: result.asset, updated_at: new Date().toISOString() }).eq("id", id);
    }
    const credits = result.charged ? await getMyCredits(session.supabase) : null;
    return NextResponse.json({ request: toRequestItem({ ...row, model_asset: result.asset }), credits });
  } catch (err) {
    await logEvent("warn", "provider:meshy", "Suivi de la tâche Meshy impossible.", { details: String(err), requestId: id, supabase: session.supabase });
    return NextResponse.json({ request: toRequestItem(row) });
  }
}
