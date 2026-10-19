import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SURAHS } from "../quran/data";
import type { PassageRef } from "./analyze";
import type { SessionRow } from "./history";

export const SESSION_COLUMNS =
  "id, surah, verse_start, verse_end, word_start, word_end, attempt_number, correct_words, total_words, errors, created_at";

export type SurahMeta = { number: number; nameArabic: string; nameFrench: string; transliteration: string; verses: number };

/** Liste compacte des 114 sourates pour la recherche côté client. */
export const SURAH_META: SurahMeta[] = SURAHS.map((s) => ({
  number: s.id,
  nameArabic: s.name,
  nameFrench: s.translation,
  transliteration: s.transliteration,
  verses: s.total_verses,
}));

export async function noticeAccepted(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("tajweed_notice_accepted_at").maybeSingle();
  return Boolean(data?.tajweed_notice_accepted_at);
}

export async function passageSessions(supabase: SupabaseClient, ref: PassageRef): Promise<SessionRow[]> {
  let q = supabase
    .from("tajweed_sessions")
    .select(SESSION_COLUMNS)
    .match({ surah: ref.surah, verse_start: ref.verseStart, verse_end: ref.verseEnd });
  q = ref.wordStart != null ? q.eq("word_start", ref.wordStart) : q.is("word_start", null);
  q = ref.wordEnd != null ? q.eq("word_end", ref.wordEnd) : q.is("word_end", null);
  const { data } = await q.order("created_at", { ascending: true });
  return (data ?? []) as SessionRow[];
}
