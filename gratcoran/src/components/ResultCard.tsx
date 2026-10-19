"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { pratiqueHref } from "@/lib/tajweed/links";
import type { Recognition } from "@/lib/quran/present";
import { ConfidenceBadge, SurahHeader, VerseBlock, verseRangeLabel } from "./quran";
import { Button } from "./ui";

/** Passage à travailler dans l'onglet Tajweed : les versets reconnus, sinon le début de la sourate. */
function practiceHref(r: Recognition): string {
  const surah = r.surah!;
  if (r.showVerse && r.verseStart) {
    const to = Math.min(r.verseEnd ?? r.verseStart, r.verseStart + 2);
    return pratiqueHref({ surah: surah.number, verseStart: r.verseStart, verseEnd: to });
  }
  return pratiqueHref({ surah: surah.number, verseStart: 1, verseEnd: Math.min(3, surah.totalVerses) });
}

const TIPS = [
  "Rapproche-toi de la source sonore.",
  "Réduis le bruit autour de toi.",
  "Enregistre 5 à 10 secondes de récitation.",
];

const LOW_REASONS: Record<string, string> = {
  basmala:
    "Je n'entends que la basmala, qui ouvre presque toutes les sourates. Laisse la récitation continuer un peu plus longtemps.",
  short: "L'extrait entendu est trop court pour identifier le passage.",
  empty: "Je n'ai entendu aucune récitation dans cet enregistrement.",
  weak: "Ce que j'ai entendu ne correspond clairement à aucun passage du Coran.",
  ambiguous: "Plusieurs passages se ressemblent trop pour trancher.",
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 28 } },
};

type Props = {
  recognition: Recognition;
  transcript: string;
  saved: boolean;
  onRetry: () => void;
};

export function ResultCard({ recognition: r, transcript, saved, onRetry }: Props) {
  if (r.confidence === "low" || !r.surah) {
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={item}>
          <ConfidenceBadge level="low" />
        </motion.div>
        <motion.div variants={item}>
          <h2 className="text-xl font-bold tracking-tight">Je ne suis pas sûr du passage</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
            {LOW_REASONS[r.lowReason ?? "weak"] ?? LOW_REASONS.weak}
          </p>
        </motion.div>
        <motion.ul variants={item} className="space-y-2 rounded-2xl bg-bg/70 p-4 text-[15px]">
          {TIPS.map((tip) => (
            <li key={tip} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" aria-hidden />
              {tip}
            </li>
          ))}
        </motion.ul>
        {r.surah && r.lowReason !== "empty" && (
          <motion.p variants={item} className="text-sm text-muted">
            Piste peu fiable : sourate {r.surah.number}, {r.surah.transliteration} ({r.surah.nameFrench}).
          </motion.p>
        )}
        <motion.div variants={item}>
          <Button onClick={onRetry}>Réessayer</Button>
        </motion.div>
        <Transcript text={transcript} />
      </motion.div>
    );
  }

  const range = verseRangeLabel(r.verseStart, r.verseEnd);
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={item} className="flex items-center justify-between">
        <ConfidenceBadge level={r.confidence} />
        {saved && <span className="text-xs font-medium text-muted">Ajouté à l&apos;historique</span>}
      </motion.div>

      <motion.div variants={item}>
        {r.confidence === "medium" && (
          <p className="mb-2 text-sm font-medium text-muted">Probablement…</p>
        )}
        <SurahHeader surah={r.surah} />
      </motion.div>

      {r.showVerse && (
        <>
          <motion.div variants={item} className="flex items-baseline justify-between">
            <h3 className="text-[17px] font-semibold">{range}</h3>
            <span className="text-sm text-muted">sur {r.surah.totalVerses}</span>
          </motion.div>
          {r.otherVerses.length > 0 && (
            <motion.div variants={item} className="rounded-2xl bg-amber-500/10 p-4 text-[15px]">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Plusieurs versets possibles</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                Ce passage se répète dans la sourate. Autres versets possibles :{" "}
                {r.otherVerses.join(", ")}.
              </p>
            </motion.div>
          )}
          {r.verses.map((v) => (
            <motion.div key={v.number} variants={item}>
              <VerseBlock verse={v} />
            </motion.div>
          ))}
        </>
      )}

      {r.otherSurahs.length > 0 && (
        <motion.p variants={item} className="text-sm text-muted">
          Autres possibilités :{" "}
          {r.otherSurahs.map((s) => `${s.transliteration} (${s.number})`).join(", ")}.
        </motion.p>
      )}

      <motion.div variants={item} className="grid gap-3">
        <Link
          href={practiceHref(r)}
          className="pressable flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sea to-emerald-deep font-semibold text-white shadow-lg shadow-sea/20"
        >
          Corriger ma récitation
        </Link>
        <Button variant="secondary" onClick={onRetry}>
          Nouvelle écoute
        </Button>
      </motion.div>
      <Transcript text={transcript} />
    </motion.div>
  );
}

function Transcript({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="group rounded-2xl border border-line px-4 py-3 text-sm">
      <summary className="cursor-pointer list-none font-medium text-muted">
        Texte entendu (transcription automatique)
      </summary>
      <p lang="ar" dir="rtl" className="mt-2 text-right text-base leading-loose">
        {text}
      </p>
    </details>
  );
}

export function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Analyse en cours">
      <div className="h-6 w-36 animate-pulse rounded-full bg-line" />
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 animate-pulse rounded-2xl bg-line" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded-lg bg-line" />
          <div className="h-4 w-1/2 animate-pulse rounded-lg bg-line" />
        </div>
      </div>
      <div className="space-y-2 rounded-2xl bg-bg/70 p-4">
        <div className="ml-auto h-6 w-11/12 animate-pulse rounded-lg bg-line" />
        <div className="ml-auto h-6 w-3/4 animate-pulse rounded-lg bg-line" />
        <div className="h-4 w-full animate-pulse rounded-lg bg-line" />
      </div>
      <p className="text-center text-sm text-muted">Analyse de la récitation…</p>
    </div>
  );
}
