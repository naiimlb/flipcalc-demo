"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import type { SurahInfo } from "@/lib/quran/present";
import { RecognizeScreen } from "./RecognizeScreen";
import { SurahHeader } from "./quran";
import { Sheet } from "./Sheet";
import { FlameIcon } from "./StatTile";
import { StreakValue } from "./StreakValue";

export type RecentSurah = {
  surah: SurahInfo;
  verseStart: number | null;
  verseEnd: number | null;
  date: string;
  practiceHref: string;
};

export type ResumePractice = {
  title: string;
  subtitle: string;
  score: string;
  href: string;
};

type Props = {
  name: string;
  recognitionCount: number;
  activityDates: string[];
  recent: RecentSurah[];
  resume: ResumePractice | null;
};

const cascade = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

export function HomeScreen({ name, recognitionCount, activityDates, recent, resume }: Props) {
  const [selected, setSelected] = useState<RecentSurah | null>(null);

  const header = (
    <header className="w-full pt-5">
      <p className="text-[15px] font-medium text-muted">Salam,</p>
      <h1 className="truncate text-[30px] font-extrabold leading-tight tracking-tight">{name}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="glass inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold">
          <FlameIcon />
          <StreakValue dates={activityDates} />
          <span className="font-medium text-muted">jour(s) d&apos;affilée</span>
        </span>
        <span className="glass inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold">
          <span className="tabular-nums">{recognitionCount}</span>
          <span className="font-medium text-muted">reconnaissance{recognitionCount > 1 ? "s" : ""}</span>
        </span>
      </div>
    </header>
  );

  return (
    <>
      <RecognizeScreen
        header={header}
        footer={({ start }) => (
          <motion.div variants={cascade} initial="hidden" animate="show" className="w-full space-y-6 pb-4">
            <motion.div variants={item} className="grid grid-cols-2 gap-3">
              <button type="button" onClick={start} className="glass pressable flex min-h-[112px] flex-col justify-between rounded-3xl p-4 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[16px] font-bold">Reconnaître</span>
                  <span className="block text-[13px] text-muted">Quelle sourate ?</span>
                </span>
              </button>
              <Link href="/tajweed" className="glass pressable flex min-h-[112px] flex-col justify-between rounded-3xl p-4">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sea to-emerald-deep text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7.5c3-1.2 6-1 9 1.2 3-2.2 6-2.4 9-1.2V19c-3-1.2-6-1-9 1.2C9 18 6 17.8 3 19V7.5Z" />
                    <path d="M12 8.7v11.5" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[16px] font-bold">Corriger mon tajweed</span>
                  <span className="block text-[13px] text-muted">S&apos;entraîner verset par verset</span>
                </span>
              </Link>
            </motion.div>

            <motion.section variants={item} aria-labelledby="recent-title">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="recent-title" className="text-[19px] font-bold tracking-tight">Récemment reconnues</h2>
                {recent.length > 0 && (
                  <Link href="/historique" className="min-h-[44px] py-2 text-[14px] font-semibold text-emerald-deep dark:text-emerald">
                    Historique
                  </Link>
                )}
              </div>
              {recent.length ? (
                <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
                  {recent.map((r) => (
                    <li key={`${r.surah.number}-${r.date}`} className="snap-start">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="glass pressable flex h-[132px] w-[148px] flex-col justify-between rounded-3xl p-4 text-left"
                      >
                        <span className="flex items-start justify-between">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-[14px] font-bold text-white">{r.surah.number}</span>
                          <span lang="ar" dir="rtl" className="quran text-[22px] leading-none">{r.surah.nameArabic}</span>
                        </span>
                        <span>
                          <span className="block truncate text-[15px] font-bold">{r.surah.transliteration}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {r.verseStart ? `Verset ${r.verseStart} · ` : ""}
                            {r.date}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyCard
                  title="Aucune sourate pour l'instant"
                  text="Touche le micro pendant une récitation : la sourate reconnue apparaîtra ici."
                />
              )}
            </motion.section>

            <motion.section variants={item} aria-labelledby="resume-title">
              <h2 id="resume-title" className="mb-2 text-[19px] font-bold tracking-tight">Reprendre ma pratique</h2>
              {resume ? (
                <Link href={resume.href} className="glass pressable flex min-h-[76px] items-center gap-3 rounded-3xl p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sea to-emerald-deep text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{resume.title}</span>
                    <span className="block truncate text-[13px] text-muted">{resume.subtitle}</span>
                  </span>
                  <span className="text-[14px] font-bold tabular-nums text-emerald-deep dark:text-emerald">{resume.score}</span>
                </Link>
              ) : (
                <EmptyCard
                  title="Commence ta première séance"
                  text="Choisis un verset, récite-le et découvre les points à travailler."
                  href="/tajweed"
                  cta="Corriger mon tajweed"
                />
              )}
            </motion.section>
          </motion.div>
        )}
      />

      <Sheet open={!!selected} onClose={() => setSelected(null)} label="Sourate récemment reconnue">
        {selected && (
          <div className="space-y-4">
            <SurahHeader surah={selected.surah} />
            <p className="text-[14px] text-muted">
              Reconnue le {selected.date}
              {selected.verseStart ? `, verset ${selected.verseStart}` : ""}.
            </p>
            <Link href={selected.practiceHref} className="pressable flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">
              Corriger ma récitation
            </Link>
            <Link href="/historique" className="pressable flex h-12 items-center justify-center rounded-2xl border border-line bg-surface font-semibold">
              Voir l&apos;historique
            </Link>
          </div>
        )}
      </Sheet>
    </>
  );
}

function EmptyCard({ title, text, href, cta }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="glass flex items-center gap-4 rounded-3xl p-4">
      <div className="flex h-12 shrink-0 items-end gap-1" aria-hidden>
        {[16, 28, 40, 24].map((h, i) => (
          <span key={i} className="w-2 rounded-full bg-brand opacity-70" style={{ height: h }} />
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-bold">{title}</p>
        <p className="text-[13px] leading-snug text-muted">{text}</p>
        {href && cta && (
          <Link href={href} className="mt-1 inline-flex min-h-[36px] items-center text-[14px] font-semibold text-emerald-deep dark:text-emerald">
            {cta} ›
          </Link>
        )}
      </div>
    </div>
  );
}
