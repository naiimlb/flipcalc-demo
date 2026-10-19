import type { Metadata } from "next";
import Link from "next/link";
import { SURAHS } from "@/lib/quran/data";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildPassage, masteryOf, parsePassageKey, passageKey, validateRef } from "@/lib/tajweed/analyze";
import { errorEvolution } from "@/lib/tajweed/history";
import { pratiqueHref } from "@/lib/tajweed/links";
import { passageSessions } from "@/lib/tajweed/server";
import { DeleteButton } from "@/components/tajweed/DeleteButton";
import { MasteryBadge, passageLabel, shortDate } from "@/components/tajweed/PassageCard";
import { Sparkline } from "@/components/tajweed/Sparkline";

export const metadata: Metadata = { title: "Détail du passage · Grat'Coran" };
export const dynamic = "force-dynamic";

export default async function PassageDetail({ params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  const ref = parsePassageKey(decodeURIComponent(cle));
  const supabase = await getServerSupabase();
  const rows = ref && !validateRef(SURAHS, ref) ? await passageSessions(supabase, ref) : [];

  if (!ref || rows.length === 0) {
    return (
      <main className="pb-tabbar mx-auto max-w-md px-5 pt-6">
        <div className="glass space-y-4 rounded-3xl p-6">
          <h1 className="text-xl font-bold">Passage sans essai</h1>
          <p className="text-[15px] text-muted">Ce passage n&apos;a pas (ou plus) d&apos;essai enregistré.</p>
          <Link href="/tajweed/parcours" className="pressable flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">
            Mon parcours
          </Link>
        </div>
      </main>
    );
  }

  const surah = SURAHS[ref.surah - 1];
  const passage = buildPassage(SURAHS, ref);
  const wordText = (i: number) => passage.words.find((w) => w.index === i)?.text ?? "";
  const scores = rows.map((r) => r.correct_words / r.total_words);
  const best = Math.max(...scores);
  const { corrected, recurring } = errorEvolution(rows);
  const key = passageKey(passage.ref);

  return (
    <main className="pb-tabbar mx-auto max-w-md space-y-5 px-5 pt-4">
      <Link href="/tajweed/parcours" className="pressable inline-flex min-h-[44px] items-center text-[15px] font-semibold text-emerald-deep dark:text-emerald">
        ‹ Mon parcours
      </Link>

      <header className="glass -mt-1 rounded-[28px] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-lg font-bold text-white">{surah.id}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-bold tracking-tight">{surah.transliteration}</h1>
            <p className="text-[14px] text-muted">{passageLabel({ ref: passage.ref })}</p>
          </div>
          <span lang="ar" dir="rtl" className="quran text-[28px] leading-none">{surah.name}</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <MasteryBadge mastery={masteryOf(best)} />
            <p className="mt-2 text-[14px] text-muted">
              Meilleur score <span className="font-bold text-ink">{Math.round(best * 100)} %</span> · {rows.length} essai{rows.length > 1 ? "s" : ""}
            </p>
          </div>
          <Sparkline scores={scores} width={120} height={40} />
        </div>
        <Link
          href={pratiqueHref(passage.ref)}
          className="pressable mt-4 flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white shadow-lg shadow-emerald/20"
        >
          Retravailler ce passage
        </Link>
      </header>

      {(corrected.length > 0 || recurring.length > 0) && (
        <section className="grid gap-3">
          {corrected.length > 0 && (
            <div className="glass rounded-3xl p-4">
              <h2 className="text-[15px] font-bold text-emerald-deep dark:text-emerald">Erreurs corrigées</h2>
              <p lang="ar" dir="rtl" className="quran mt-1 text-[22px]">{corrected.map(wordText).join("  ·  ")}</p>
            </div>
          )}
          {recurring.length > 0 && (
            <div className="glass rounded-3xl p-4">
              <h2 className="text-[15px] font-bold text-rose-700 dark:text-rose-300">Erreurs récurrentes</h2>
              <p lang="ar" dir="rtl" className="quran mt-1 text-[22px]">{recurring.map(wordText).join("  ·  ")}</p>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="attempts-title">
        <h2 id="attempts-title" className="mb-2 text-[19px] font-bold tracking-tight">Essais</h2>
        <ol className="glass divide-y divide-line overflow-hidden rounded-3xl">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg text-[13px] font-bold">{r.attempt_number}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold tabular-nums">
                  {r.correct_words}/{r.total_words} mots justes
                </span>
                <span className="block text-[13px] text-muted">
                  {shortDate(r.created_at)} · {r.errors.length} point{r.errors.length > 1 ? "s" : ""} à revoir
                </span>
              </span>
              <DeleteButton kind="attempt" id={r.id} label={`Supprimer l'essai ${r.attempt_number}`} />
            </li>
          ))}
        </ol>
      </section>

      <DeleteButton kind="passage" passageKey={key} label="Supprimer ce passage" />
    </main>
  );
}
