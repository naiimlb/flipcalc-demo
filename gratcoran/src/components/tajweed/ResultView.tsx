"use client";

import { motion } from "framer-motion";
import type { Analysis, Comparison, ErrorType, PassageWord, TajweedError, WordResult } from "@/lib/tajweed/analyze";
import { FAMILY_COLORS, RULES } from "@/lib/tajweed/rules";
import { RESULT_REMINDER } from "./NoticeText";
import { RulePill, shortName } from "./RulePills";

type Ok = Extract<Analysis, { status: "ok" }>;

const TYPE_LABELS: Record<ErrorType, string> = {
  letter: "Lettre confondue",
  partial: "Mot incomplet",
  wrong: "Mot différent",
  missing: "Mot manquant",
  added: "Mot ajouté",
  inverted: "Mots inversés",
};

const STATUS_STYLE: Record<WordResult["status"], { cls: string; label: string }> = {
  correct: { cls: "bg-emerald/10 text-emerald-800 dark:text-emerald-200", label: "juste" },
  approx: {
    cls: "bg-amber-500/15 text-amber-800 underline decoration-amber-500 decoration-2 underline-offset-[10px] dark:text-amber-200",
    label: "approximatif",
  },
  error: {
    cls: "bg-rose-500/15 text-rose-800 underline decoration-rose-500 decoration-wavy decoration-2 underline-offset-[10px] dark:text-rose-200",
    label: "erreur",
  },
  missing: {
    cls: "bg-rose-500/10 text-rose-800/80 line-through decoration-rose-500 decoration-2 dark:text-rose-200/80",
    label: "manquant",
  },
};

/** Texte du passage coloré mot à mot (couleur + soulignement : jamais la couleur seule). */
export function ColoredText({
  words,
  results,
  errors,
  corrected = [],
}: {
  words: PassageWord[];
  results: WordResult[];
  errors: TajweedError[];
  corrected?: number[];
}) {
  const added = new Map<number, string[]>();
  for (const e of errors) {
    if (e.type !== "added") continue;
    added.set(e.index, [...(added.get(e.index) ?? []), e.heard]);
  }
  const byIndex = new Map(results.map((r) => [r.index, r]));
  const fixed = new Set(corrected);
  return (
    <p lang="ar" dir="rtl" className="quran flex flex-wrap gap-x-1.5 gap-y-2 text-[28px] leading-[2.2]">
      {added.get(-1)?.map((h, k) => <AddedChip key={`a-${k}`} heard={h} />)}
      {words.map((w) => {
        const r = byIndex.get(w.index);
        const st = STATUS_STYLE[r?.status ?? "correct"];
        return (
          <span key={w.index} className="contents">
            <motion.span
              initial={fixed.has(w.index) ? { backgroundColor: "rgba(245,158,11,0.35)", scale: 0.92 } : false}
              animate={fixed.has(w.index) ? { backgroundColor: "rgba(16,185,129,0.14)", scale: [0.92, 1.08, 1] } : undefined}
              transition={{ duration: 0.9, delay: 0.25 + (w.index % 8) * 0.06 }}
              className={`rounded-lg px-1 ${st.cls}`}
              aria-label={`${w.text} : ${st.label}`}
            >
              {w.text}
            </motion.span>
            {added.get(w.index)?.map((h, k) => <AddedChip key={`a-${w.index}-${k}`} heard={h} />)}
          </span>
        );
      })}
    </p>
  );
}

function AddedChip({ heard }: { heard: string }) {
  return (
    <span
      className="self-center rounded-full border border-dashed border-rose-400 px-2 font-sans text-[15px] leading-7 text-rose-700 dark:text-rose-300"
      aria-label={`Mot ajouté : ${heard}`}
    >
      + {heard}
    </span>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald" />Juste</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Approximatif</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Erreur ou mot manquant</li>
    </ul>
  );
}

export function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const ratio = total ? correct / total : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`${correct} mots justes sur ${total}`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-line" />
        <defs>
          <linearGradient id="score" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#10b981" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#score)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[22px] font-extrabold leading-none tabular-nums">
            {correct}
            <span className="text-[15px] font-bold text-muted">/{total}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">mots justes</p>
        </div>
      </div>
    </div>
  );
}

export function ComparisonCard({ comparison, attempt, words }: { comparison: Comparison; attempt: number | null; words: PassageWord[] }) {
  const text = (i: number) => words.find((w) => w.index === i)?.text ?? "";
  const better = comparison.currentErrors < comparison.previousErrors;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          {attempt ? `Essai n° ${attempt}` : "Par rapport à ton essai précédent"}
        </p>
        <p className={`text-[15px] font-bold ${better ? "text-emerald-deep dark:text-emerald" : "text-ink"}`}>
          {comparison.previousErrors} erreur{comparison.previousErrors > 1 ? "s" : ""} → {comparison.currentErrors}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={comparison.corrected.length} label="corrigé(s)" tone="good" />
        <Stat value={comparison.remaining.length} label="restant(s)" tone="neutral" />
        <Stat value={comparison.newErrors.length} label="nouveau(x)" tone="bad" />
      </div>
      {comparison.corrected.length > 0 && (
        <p lang="ar" dir="rtl" className="quran mt-3 text-[20px] text-emerald-700 dark:text-emerald-300">
          {comparison.corrected.map(text).join("  ·  ")}
        </p>
      )}
    </motion.div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "good" | "neutral" | "bad" }) {
  const cls =
    tone === "good" ? "text-emerald-deep dark:text-emerald" : tone === "bad" ? "text-rose-600 dark:text-rose-300" : "text-ink";
  return (
    <div className="rounded-2xl bg-bg/70 py-2">
      <p className={`text-[20px] font-extrabold tabular-nums ${cls}`}>{value}</p>
      <p className="text-[12px] text-muted">{label}</p>
    </div>
  );
}

export function ErrorCard({ error, index }: { error: TajweedError; index: number }) {
  const rule = error.rule ? RULES[error.rule] : null;
  const color = rule ? FAMILY_COLORS[rule.family] : "#e11d48";
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, type: "spring", stiffness: 320, damping: 28 }}
      className="glass overflow-hidden rounded-3xl"
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-1 h-9 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[12px] font-bold text-rose-700 dark:text-rose-300">
              {TYPE_LABELS[error.type]}
            </span>
            {error.word && (
              <span lang="ar" dir="rtl" className="quran text-[26px] leading-none">
                {error.word}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
            {error.word && (
              <>
                <dt className="text-muted">Attendu</dt>
                <dd lang="ar" dir="rtl" className="quran text-right text-[20px] leading-snug">{error.word}</dd>
              </>
            )}
            <dt className="text-muted">Entendu</dt>
            <dd lang="ar" dir="rtl" className="text-right text-[17px]">
              {error.heard || <span className="font-sans text-[14px] text-muted">rien</span>}
            </dd>
          </dl>
          {error.letters && error.letters.length > 0 && (
            <p className="text-[14px]">
              {error.letters.map((l, k) => (
                <span key={k} className="mr-3 inline-flex items-center gap-1.5">
                  <span className="font-semibold" lang="ar">{l.expected}</span>
                  <span className="text-muted">attendu, entendu</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-300" lang="ar">{l.heard}</span>
                </span>
              ))}
            </p>
          )}
          {rule && (
            <div className="rounded-2xl bg-bg/70 p-3">
              <p className="text-[14px] font-semibold">
                {rule.nameFr}{" "}
                <span lang="ar" dir="rtl" className="quran text-[17px]" style={{ color }}>
                  {rule.nameAr}
                </span>
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{rule.lesson}</p>
            </div>
          )}
          {(error.tip || rule) && (
            <p className="text-[14px] leading-relaxed">
              <span className="font-semibold text-emerald-deep dark:text-emerald">Conseil : </span>
              {error.tip ?? rule?.tip}
            </p>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function AttentionPoints({ analysis, words }: { analysis: Ok; words: PassageWord[] }) {
  if (!analysis.attention.length) return null;
  const text = (i: number) => words.find((w) => w.index === i)?.text ?? "";
  return (
    <section className="glass rounded-3xl p-4" aria-labelledby="attention-title">
      <h3 id="attention-title" className="text-[16px] font-bold">Points d&apos;attention</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-muted">
        Ces règles ne sont pas évaluées : l&apos;outil ne peut pas les juger avec certitude. Vérifie-les à l&apos;écoute.
      </p>
      <ul className="mt-3 space-y-3">
        {analysis.attention.map((a) => (
          <li key={a.rule} className="space-y-1.5">
            <RulePill id={a.rule} />
            <p lang="ar" dir="rtl" className="quran text-[20px] text-muted">
              {a.words.slice(0, 6).map(text).join("  ·  ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Reminder() {
  return <p className="text-center text-[13px] font-medium text-muted">{RESULT_REMINDER}</p>;
}

export { shortName };
