import { jsonError } from "@/lib/http";
import { getModelProvider, isAllowedAssetUrl, type ModelAsset } from "@/lib/providers";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 60 * 1024 * 1024;

/**
 * Proxy du maillage GLB : l'URL du fournisseur n'est jamais exposée au navigateur
 * et seuls ses hôtes déclarés sont autorisés (pas de SSRF).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return jsonError(400, "Identifiant invalide.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");

  const { data: row } = await session.supabase.from("design_requests").select("model_asset").eq("id", id).maybeSingle();
  const asset = row?.model_asset as ModelAsset | null | undefined;
  if (!asset || asset.status !== "succeeded" || !asset.glbUrl) return jsonError(404, "Maillage indisponible.");
  const provider = getModelProvider(asset.provider);
  if (!provider || !isAllowedAssetUrl(provider, asset.glbUrl)) return jsonError(400, "Source du maillage refusée.");

  const upstream = await fetch(asset.glbUrl, { cache: "no-store" });
  const length = Number(upstream.headers.get("content-length") ?? 0);
  if (!upstream.ok || !upstream.body || length > MAX_BYTES) return jsonError(502, "Téléchargement du maillage impossible.");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "private, max-age=3600",
      ...(length ? { "Content-Length": String(length) } : {}),
    },
  });
}
