"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supprime une entrée de l'historique (la RLS garantit qu'elle appartient à l'utilisateur). */
export async function deleteRecognition(id: string): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(id)) return { ok: false };
  const supabase = await getServerSupabase();
  const { error, count } = await supabase
    .from("recognitions")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) console.error("[historique] suppression impossible :", error.code);
  revalidatePath("/historique");
  return { ok: !error && (count ?? 0) > 0 };
}
