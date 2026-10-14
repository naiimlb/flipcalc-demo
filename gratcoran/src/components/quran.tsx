import type { Confidence } from "@/lib/quran/matcher";
import type { SurahInfo, VerseInfo } from "@/lib/quran/present";

const CONFIDENCE = {
  high: { label: "Confiance haute", className: "bg-emerald/15 text-emerald-deep dark:text-emerald" },
  medium: { label: "Confiance moyenne", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  low: { label: "Confiance faible", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
} satisfies Record<Confidence, { label: string; className: string }>;

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const c = CONFIDENCE[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.className}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-1 rounded-full bg-current ${
              i > (level === "high" ? 2 : level === "medium" ? 1 : 0) ? "opacity-25" : ""
            }`}
          />
        ))}
      </span>
      {c.label}
    </span>
  );
}

export function SurahHeader({ surah, compact = false }: { surah: SurahInfo; compact?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`grid shrink-0 place-items-center rounded-2xl bg-brand font-bold text-white shadow-md shadow-emerald/20 ${
          compact ? "h-11 w-11 text-base" : "h-14 w-14 text-xl"
        }`}
        aria-label={`Sourate numéro ${surah.number}`}
      >
        {surah.number}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-bold tracking-tight ${compact ? "text-[17px]" : "text-xl"}`}>
          {surah.transliteration}
        </p>
        <p className="truncate text-[15px] text-muted">
          {surah.nameFrench} · {surah.totalVerses} versets
        </p>
      </div>
      <p lang="ar" dir="rtl" className={`quran shrink-0 leading-none ${compact ? "text-2xl" : "text-[34px]"}`}>
        {surah.nameArabic}
      </p>
    </div>
  );
}

/** Verset : texte arabe original (non modifié) puis traduction française. */
export function VerseBlock({ verse }: { verse: VerseInfo }) {
  return (
    <figure className="rounded-2xl bg-bg/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-line/70 px-2.5 py-0.5 text-xs font-semibold text-muted">
          Verset {verse.number}
        </span>
      </div>
      <blockquote lang="ar" dir="rtl" className="quran text-[26px] text-ink">
        {verse.text}
      </blockquote>
      <figcaption lang="fr" className="mt-3 text-[15px] leading-relaxed text-muted">
        {verse.translation}
      </figcaption>
    </figure>
  );
}

export function verseRangeLabel(start: number | null, end: number | null): string | null {
  if (!start) return null;
  return end && end !== start ? `Versets ${start} à ${end}` : `Verset ${start}`;
}
