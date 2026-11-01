import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { logEvent } from "@/lib/logs";
import { getModelProvider, type ModelAsset } from "@/lib/providers";
import { toRequestItem, REQUEST_COLUMNS } from "@/lib/requests";
import { getSecret } from "@/lib/secrets";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sondage d'un maillage externe (fournisseur text-to-3D) : met à jour et renvoie la demande. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return jsonError(400, "Identifiant invalide.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");

  // Lecture avec la session : la RLS garantit que la demande appartient à l'utilisateur (ou admin).
  const { data: row } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  if (!row) return jsonError(404, "Demande introuvable.");

  const asset = row.model_asset as ModelAsset | null;
  if (!asset || asset.status === "succeeded" || asset.status === "failed") {
    return NextResponse.json({ request: toRequestItem(row) });
  }
  const provider = getModelProvider(asset.provider);
  const key = provider?.secretName ? await getSecret(provider.secretName) : null;
  const service = getServiceSupabase();
  if (!provider || !key || !service) return NextResponse.json({ request: toRequestItem(row) });

  try {
    const next = await provider.poll(asset, key);
    await service.from("design_requests").update({ model_asset: next, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ request: toRequestItem({ ...row, model_asset: next }) });
  } catch (err) {
    await logEvent("warn", `provider:${provider.id}`, "Sondage du maillage impossible.", {
      details: String(err),
      requestId: id,
      userId: session.user.id,
    });
    return NextResponse.json({ request: toRequestItem(row) });
  }
}
