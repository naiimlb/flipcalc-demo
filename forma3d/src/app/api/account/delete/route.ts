import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function removeFolder(supabase: SupabaseClient, bucket: string, userId: string) {
  for (let round = 0; round < 20; round++) {
    const { data } = await supabase.storage.from(bucket).list(userId, { limit: 100 });
    if (!data?.length) return;
    const { error } = await supabase.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
    if (error) throw new Error(error.message);
  }
}

/** Suppression définitive du compte : fichiers Storage, puis utilisateur (le reste suit en cascade). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "SUPPRIMER") return jsonError(400, "Confirmation manquante.");

  try {
    await removeFolder(session.supabase, "models", session.user.id);
    await removeFolder(session.supabase, "avatars", session.user.id);
  } catch (err) {
    console.error("Suppression des fichiers :", err);
    return jsonError(500, "Suppression des fichiers impossible : réessayez.");
  }
  const { error } = await session.supabase.rpc("delete_my_account");
  if (error) {
    console.error("Suppression du compte :", error.message);
    return jsonError(500, "Suppression du compte impossible.");
  }
  await session.supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
