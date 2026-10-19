import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { SESSION_COLUMNS, SURAH_META } from "@/lib/tajweed/server";
import { summarizePassages, type SessionRow } from "@/lib/tajweed/history";
import { NoticeBanner } from "@/components/tajweed/NoticeBanner";
import { PassagePicker } from "@/components/tajweed/PassagePicker";
import { PassageCard } from "@/components/tajweed/PassageCard";
import { StatTile, FlameIcon } from "@/components/StatTile";
import { StreakValue } from "@/components/StreakValue";

export const metadata: Metadata = { title: "Tajweed · Grat'Coran" };
export const dynamic = "force-dynamic";

export default async function TajweedHome() {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("tajweed_sessions")
    .select(SESSION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as SessionRow[];
  const passages = summarizePassages(rows);
  const mastered = passages.filter((p) => p.mastery === "mastered").length;

  return (
    <main className="pb-tabbar mx-auto max-w-md space-y-5 px-5 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">Tajweed</h1>
          <p className="text-[15px] text-muted">Récite, compare, progresse.</p>
        </div>
        <Link
          href="/tajweed/parcours"
          className="pressable mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand px-4 text-[14px] font-semibold text-white shadow-lg shadow-emerald/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />
          </svg>
          Mon parcours
        </Link>
      </header>

      <NoticeBanner />
      <PassagePicker surahs={SURAH_META} />

      {passages.length > 0 ? (
        <section aria-labelledby="recent-title" className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Essais" value={rows.length} />
            <StatTile label="Maîtrisés" value={mastered} />
            <StatTile label="Série" icon={<FlameIcon />} value={<StreakValue dates={rows.map((r) => r.created_at)} />} />
          </div>
          <div className="flex items-baseline justify-between pt-2">
            <h2 id="recent-title" className="text-[19px] font-bold tracking-tight">
              Reprendre ma pratique
            </h2>
            <Link href="/tajweed/parcours" className="min-h-[44px] py-2 text-[14px] font-semibold text-emerald-deep dark:text-emerald">
              Tout voir
            </Link>
          </div>
          <ul className="space-y-3">
            {passages.slice(0, 3).map((p, i) => (
              <li key={p.key} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <PassageCard p={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="glass flex flex-col items-center rounded-[28px] px-6 py-8 text-center">
          <div className="flex h-14 items-end gap-1.5" aria-hidden>
            {[18, 30, 42, 26, 36].map((h, i) => (
              <span key={i} className="w-2.5 rounded-full bg-brand opacity-80" style={{ height: h }} />
            ))}
          </div>
          <h2 className="mt-5 text-[19px] font-bold tracking-tight">Ton parcours commence ici</h2>
          <p className="mt-1.5 max-w-xs text-[15px] text-muted">
            Choisis un passage ci-dessus : chaque essai sera enregistré pour suivre tes progrès.
          </p>
        </section>
      )}
    </main>
  );
}
