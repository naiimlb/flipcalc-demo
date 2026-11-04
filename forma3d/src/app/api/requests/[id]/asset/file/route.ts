import { jsonError } from "@/lib/http";
import { getModelProvider, isAllowedAssetUrl, type ModelAsset } from "@/lib/providers";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 60 * 1024 * 1024;

/**
 * Fichier GLB d'un maillage Meshy du projet (le dernier, ou une version précédente avec ?k=<clé>).
 * Servi depuis la copie dans Supabase Storage quand elle existe, sinon par proxy depuis Meshy :
 * l'URL du fournisseur n'est jamais exposée au navigateur et seuls ses hôtes déclarés sont autorisés (pas de SSRF).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return jsonError(400, "Identifiant invalide.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");

  const { data: row } = await session.supabase.from("design_requests").select("model_asset").eq("id", id).maybeSingle();
  const asset = row?.model_asset as ModelAsset | null | undefined;
  if (!asset) return jsonError(404, "Maillage indisponible.");
  const wanted = new URL(request.url).searchParams.get("k");
  const entry =
    wanted && asset.taskId.slice(0, 12) !== wanted
      ? asset.history?.find((h) => h.taskId.slice(0, 12) === wanted) ?? null
      : asset.status === "succeeded"
        ? { glbUrl: asset.glbUrl ?? null, storedPath: asset.storedPath ?? null }
        : null;
  if (!entry) return jsonError(404, "Maillage indisponible.");
  const headers = { "Content-Type": "model/gltf-binary", "Cache-Control": "private, max-age=3600" };

  if (entry.storedPath) {
    const { data } = await session.supabase.storage.from("models").download(entry.storedPath);
    if (data) return new Response(data, { headers });
  }
  const provider = getModelProvider(asset.provider);
  if (!entry.glbUrl || !provider || !isAllowedAssetUrl(provider, entry.glbUrl)) return jsonError(404, "Maillage indisponible.");
  const upstream = await fetch(entry.glbUrl, { cache: "no-store" });
  const length = Number(upstream.headers.get("content-length") ?? 0);
  if (!upstream.ok || !upstream.body || length > MAX_BYTES) return jsonError(502, "Téléchargement du maillage impossible.");
  return new Response(upstream.body, { headers: { ...headers, ...(length ? { "Content-Length": String(length) } : {}) } });
}
