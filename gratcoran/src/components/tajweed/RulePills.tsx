"use client";

import { useState } from "react";
import { FAMILY_COLORS, RULES, type RuleId } from "@/lib/tajweed/rules";
import { Sheet } from "../Sheet";

export const shortName = (id: RuleId) => RULES[id].nameFr.split(" (")[0];

export function RulePill({ id, onClick, count }: { id: RuleId; onClick?: () => void; count?: number }) {
  const color = FAMILY_COLORS[RULES[id].family];
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold"
      style={{ borderColor: `${color}55`, background: `${color}14`, color }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      <span className="text-ink/90 dark:text-ink">{shortName(id)}</span>
      <span lang="ar" dir="rtl" className="quran text-[15px] leading-none" style={{ color }}>
        {RULES[id].nameAr}
      </span>
      {count != null && <span className="text-[12px] text-muted">×{count}</span>}
    </button>
  );
}

type Props = {
  rules: RuleId[];
  /** Mots du passage (texte du mushaf) portant chaque règle. */
  wordsByRule?: Partial<Record<RuleId, string[]>>;
};

/** Règles présentes dans le passage ; une pastille ouvre une mini-leçon. */
export function RulePills({ rules, wordsByRule = {} }: Props) {
  const [open, setOpen] = useState<RuleId | null>(null);
  const rule = open ? RULES[open] : null;
  if (!rules.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {rules.map((id) => (
          <RulePill key={id} id={id} onClick={() => setOpen(id)} />
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} label="Mini-leçon de tajweed">
        {rule && <RuleLesson id={rule.id} words={wordsByRule[rule.id]} />}
      </Sheet>
    </>
  );
}

export function RuleLesson({ id, words }: { id: RuleId; words?: string[] }) {
  const rule = RULES[id];
  const color = FAMILY_COLORS[rule.family];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight">{rule.nameFr}</h2>
        </div>
        <span lang="ar" dir="rtl" className="quran text-[28px] leading-none" style={{ color }}>
          {rule.nameAr}
        </span>
      </div>
      <p className="text-[16px] leading-relaxed">{rule.lesson}</p>
      <div className="rounded-2xl bg-emerald/10 p-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-emerald-deep dark:text-emerald">Conseil</p>
        <p className="mt-1 text-[15px] leading-relaxed">{rule.tip}</p>
      </div>
      {words && words.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">Dans ce passage</p>
          <p lang="ar" dir="rtl" className="quran flex flex-wrap gap-x-3 text-[26px]">
            {[...new Set(words)].map((w) => (
              <span key={w} style={{ color }}>
                {w}
              </span>
            ))}
          </p>
        </div>
      )}
      {rule.subtle && (
        <p className="rounded-2xl bg-amber-500/10 p-4 text-[14px] leading-relaxed text-amber-900 dark:text-amber-100">
          Point d&apos;attention : l&apos;outil ne peut pas juger cette règle avec certitude (durée, nasalisation, rebond ou
          timbre). Écoute-toi attentivement ou fais-toi corriger par ton enseignant.
        </p>
      )}
    </div>
  );
}
