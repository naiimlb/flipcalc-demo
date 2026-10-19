"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { parsePassageKey } from "@/lib/tajweed/analyze";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enregistre l'acceptation de l'avertissement (une seule fois par compte). */
export async function acceptTajweedNotice(): Promise<{ ok: boolean }> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, tajweed_notice_accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[tajweed] acceptation non enregistrée :", error.code);
    return { ok: false };
  }
  revalidatePath("/tajweed", "layout");
  return { ok: true };
}

/** Supprime un essai (la RLS garantit qu'il appartient à l'utilisateur). */
export async function deleteTajweedAttempt(id: string): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(id)) return { ok: false };
  const supabase = await getServerSupabase();
  const { error, count } = await supabase.from("tajweed_sessions").delete({ count: "exact" }).eq("id", id);
  revalidatePath("/tajweed", "layout");
  return { ok: !error && (count ?? 0) > 0 };
}

/** Supprime tous les essais d'un passage. */
export async function deleteTajweedPassage(key: string): Promise<{ ok: boolean }> {
  const ref = parsePassageKey(key);
  if (!ref) return { ok: false };
  const supabase = await getServerSupabase();
  let q = supabase
    .from("tajweed_sessions")
    .delete({ count: "exact" })
    .match({ surah: ref.surah, verse_start: ref.verseStart, verse_end: ref.verseEnd });
  q = ref.wordStart != null ? q.eq("word_start", ref.wordStart) : q.is("word_start", null);
  q = ref.wordEnd != null ? q.eq("word_end", ref.wordEnd) : q.is("word_end", null);
  const { error, count } = await q;
  revalidatePath("/tajweed", "layout");
  return { ok: !error && (count ?? 0) > 0 };
}
