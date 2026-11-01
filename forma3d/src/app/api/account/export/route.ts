import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export de toutes les données du compte (RGPD) : profil, dossiers, demandes, fichiers 3D. */
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");
  const { supabase, user } = session;

  const [profile, folders, requests] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, display_name, avatar_url, language, units, favorite_materials, role, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("folders").select("id, name, created_at").eq("user_id", user.id).order("created_at"),
    supabase
      .from("design_requests")
      .select("id, prompt, has_image, status, title, design, error, provider, model, duration_ms, folder_id, is_favorite, model_path, source, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  // Liens de téléchargement des fichiers 3D (valables 7 jours).
  const paths = (requests.data ?? []).map((r) => r.model_path).filter((p): p is string => Boolean(p));
  const links: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabase.storage.from("models").createSignedUrls(paths, 7 * 24 * 3600);
    for (const item of data ?? []) if (item.path && item.signedUrl) links[item.path] = item.signedUrl;
  }

  const payload = {
    format: "forma3d-export-v1",
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data,
    folders: folders.data ?? [],
    requests: (requests.data ?? []).map((r) => ({ ...r, model_download_url: r.model_path ? links[r.model_path] ?? null : null })),
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="forma3d-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
