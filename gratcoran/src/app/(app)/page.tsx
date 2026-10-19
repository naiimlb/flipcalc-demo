import { HomeScreen, type RecentSurah, type ResumePractice } from "@/components/HomeScreen";
import { SURAHS } from "@/lib/quran/data";
import { surahInfo } from "@/lib/quran/present";
import { getServerSupabase } from "@/lib/supabase/server";
import { MAX_VERSES } from "@/lib/tajweed/analyze";
import { refOfRow, type SessionRow } from "@/lib/tajweed/history";
import { pratiqueHref } from "@/lib/tajweed/links";
import { SESSION_COLUMNS } from "@/lib/tajweed/server";
import { passageLabel } from "@/components/tajweed/PassageCard";

export const dynamic = "force-dynamic";

type RecognitionRow = { surah: number; verse_start: number | null; verse_end: number | null; created_at: string };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Prénom affiché : début de l'email, avec une majuscule. */
function displayName(email: string | undefined): string {
  const local = (email ?? "").split("@")[0] || "toi";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function HomePage() {
  const supabase = await getServerSupabase();
  const [{ data: auth }, recognitions, count, sessions] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("recognitions")
      .select("surah, verse_start, verse_end, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("recognitions").select("id", { count: "exact", head: true }),
    supabase.from("tajweed_sessions").select(SESSION_COLUMNS).order("created_at", { ascending: false }).limit(200),
  ]);

  const recRows = (recognitions.data ?? []) as RecognitionRow[];
  const tajRows = (sessions.data ?? []) as SessionRow[];

  // 3 à 5 dernières sourates distinctes.
  const seen = new Set<number>();
  const recent: RecentSurah[] = [];
  for (const r of recRows) {
    if (seen.has(r.surah) || !SURAHS[r.surah - 1]) continue;
    seen.add(r.surah);
    const s = SURAHS[r.surah - 1];
    const from = r.verse_start ?? 1;
    const to = r.verse_start ? Math.min(r.verse_end ?? from, from + MAX_VERSES - 1) : Math.min(s.verses.length, MAX_VERSES);
    recent.push({
      surah: surahInfo(s),
      verseStart: r.verse_start,
      verseEnd: r.verse_end,
      date: shortDate(r.created_at),
      practiceHref: pratiqueHref({ surah: s.id, verseStart: from, verseEnd: to }),
    });
    if (recent.length === 5) break;
  }

  const last = tajRows[0];
  const resume: ResumePractice | null = last
    ? {
        title: SURAHS[last.surah - 1].transliteration,
        subtitle: `${passageLabel({ ref: refOfRow(last) })} · essai n° ${last.attempt_number}`,
        score: `${last.correct_words}/${last.total_words}`,
        href: pratiqueHref(refOfRow(last)),
      }
    : null;

  return (
    <HomeScreen
      name={displayName(auth.user?.email)}
      recognitionCount={count.count ?? recRows.length}
      activityDates={[...recRows.map((r) => r.created_at), ...tajRows.map((r) => r.created_at)]}
      recent={recent}
      resume={resume}
    />
  );
}
