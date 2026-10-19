import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { SESSION_COLUMNS } from "@/lib/tajweed/server";
import { summarizePassages, weakRules, type SessionRow } from "@/lib/tajweed/history";
import { PassageCard } from "@/components/tajweed/PassageCard";
import { RulePill } from "@/components/tajweed/RulePills";
import { StatTile, FlameIcon } from "@/components/StatTile";
import { StreakValue } from "@/components/StreakValue";

export const metadata: Metadata = { title: "Mon parcours · Grat'Coran" };
export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("tajweed_sessions")
    .select(SESSION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as SessionRow[];
  const passages = summarizePassages(rows);
  const weak = weakRules(rows);
  const days = new Set(rows.map((r) => r.created_at.slice(0, 10))).size;

  return (
    <main className="pb-tabbar mx-auto max-w-md space-y-5 px-5 pt-4">
      <Link href="/tajweed" className="pressable inline-flex min-h-[44px] items-center text-[15px] font-semibold text-emerald-deep dark:text-emerald">
        ‹ Tajweed
      </Link>
      <h1 className="-mt-2 text-[32px] font-bold tracking-tight">Mon parcours</h1>

      {rows.length === 0 ? (
        <section className="glass flex flex-col items-center rounded-[28px] px-6 py-10 text-center">
          <div className="flex h-14 items-end gap-1.5" aria-hidden>
            {[14, 24, 34, 44].map((h, i) => (
              <span key={i} className="w-3 rounded-full bg-brand" style={{ height: h, opacity: 0.4 + i * 0.2 }} />
            ))}
          </div>
          <h2 className="mt-5 text-[19px] font-bold tracking-tight">Aucun essai pour l&apos;instant</h2>
          <p className="mt-1.5 max-w-xs text-[15px] text-muted">Récite un premier passage : ta progression s&apos;affichera ici, essai après essai.</p>
          <Link href="/tajweed" className="pressable mt-6 inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
            Choisir un passage
          </Link>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Essais" value={rows.length} />
            <StatTile label="Passages maîtrisés" value={passages.filter((p) => p.mastery === "mastered").length} />
            <StatTile label="Série de jours" icon={<FlameIcon />} value={<StreakValue dates={rows.map((r) => r.created_at)} />} />
            <StatTile label="Jours de pratique" value={days} />
          </div>

          <section className="glass rounded-3xl p-4" aria-labelledby="weak-title">
            <h2 id="weak-title" className="text-[17px] font-bold">Tes points faibles</h2>
            {weak.length ? (
              <>
                <p className="mt-1 text-[14px] text-muted">Les règles le plus souvent liées à tes erreurs.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weak.map((w) => (
                    <RulePill key={w.rule} id={w.rule} count={w.count} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-muted">Aucune règle ne revient dans tes erreurs pour l&apos;instant. Continue ainsi !</p>
            )}
          </section>

          <section aria-labelledby="passages-title" className="space-y-3">
            <h2 id="passages-title" className="text-[19px] font-bold tracking-tight">Mes passages</h2>
            <ul className="space-y-3">
              {passages.map((p, i) => (
                <li key={p.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                  <PassageCard p={p} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
