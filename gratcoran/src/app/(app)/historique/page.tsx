import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSurah } from "@/lib/quran/data";
import { surahInfo, versesOf } from "@/lib/quran/present";
import { HistoryList, type HistoryEntry } from "@/components/HistoryList";
import type { Confidence } from "@/lib/quran/matcher";

export const metadata: Metadata = { title: "Historique · Grat'Coran" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  surah: number;
  verse_start: number | null;
  verse_end: number | null;
  confidence: Confidence;
  created_at: string;
};

export default async function HistoryPage() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("recognitions")
    .select("id, surah, verse_start, verse_end, confidence, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const entries: HistoryEntry[] = ((data ?? []) as Row[]).flatMap((row) => {
    const surah = getSurah(row.surah);
    if (!surah) return [];
    return [
      {
        id: row.id,
        createdAt: row.created_at,
        confidence: row.confidence,
        surah: surahInfo(surah),
        verseStart: row.verse_start,
        verseEnd: row.verse_end,
        verses: row.verse_start ? versesOf(surah, row.verse_start, row.verse_end ?? row.verse_start) : [],
      },
    ];
  });

  return (
    <main className="pb-tabbar mx-auto max-w-md px-5">
      <h1 className="pb-4 pt-6 text-[32px] font-bold tracking-tight">Historique</h1>
      {error ? (
        <p className="rounded-2xl bg-rose-500/10 p-4 text-[15px] text-rose-700 dark:text-rose-300">
          Impossible de charger l&apos;historique. Réessaie dans un instant.
        </p>
      ) : (
        <HistoryList initialEntries={entries} />
      )}
    </main>
  );
}
