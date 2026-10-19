import Link from "next/link";
import { SURAHS } from "@/lib/quran/data";
import { MASTERY_LABELS, type Mastery } from "@/lib/tajweed/analyze";
import type { PassageSummary } from "@/lib/tajweed/history";
import { parcoursHref } from "@/lib/tajweed/links";
import { Sparkline } from "./Sparkline";

const MASTERY_STYLE: Record<Mastery, string> = {
  work: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  progress: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  mastered: "bg-emerald/15 text-emerald-deep dark:text-emerald",
};

export function MasteryBadge({ mastery }: { mastery: Mastery }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold ${MASTERY_STYLE[mastery]}`}>
      {MASTERY_LABELS[mastery]}
    </span>
  );
}

export function passageLabel(p: Pick<PassageSummary, "ref">): string {
  const { verseStart: a, verseEnd: b, wordStart, wordEnd } = p.ref;
  const verses = a === b ? `Verset ${a}` : `Versets ${a}-${b}`;
  return wordStart != null && wordEnd != null ? `${verses} · mots ${wordStart + 1}-${wordEnd + 1}` : verses;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Carte d'un passage travaillé (meilleur score, essais, maîtrise, évolution). */
export function PassageCard({ p }: { p: PassageSummary }) {
  const surah = SURAHS[p.ref.surah - 1];
  return (
    <Link href={parcoursHref(p.key)} className="glass pressable flex min-h-[76px] items-center gap-3 rounded-3xl p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand font-bold text-white">{surah.id}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-bold">{surah.transliteration}</span>
          <MasteryBadge mastery={p.mastery} />
        </span>
        <span className="block truncate text-[13px] text-muted">
          {passageLabel(p)} · {p.attempts} essai{p.attempts > 1 ? "s" : ""} · {shortDate(p.lastAt)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <Sparkline scores={p.scores} />
        <span className="text-[12px] font-semibold tabular-nums text-muted">Meilleur {Math.round(p.best * 100)} %</span>
      </span>
    </Link>
  );
}
