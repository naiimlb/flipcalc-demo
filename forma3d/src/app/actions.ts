"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await getServerSupabase();
  await supabase?.auth.signOut();
  redirect("/");
}

/** Supprime une demande de l'utilisateur (la RLS refuse celles des autres, sauf admin). */
export async function deleteRequest(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Identifiant invalide." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous." };
  const { error, count } = await session.supabase.from("design_requests").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  if (!count) return { ok: false, error: "Demande introuvable." };
  revalidatePath("/");
  return { ok: true };
}
