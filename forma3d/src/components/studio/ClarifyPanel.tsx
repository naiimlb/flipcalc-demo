"use client";

import { useState } from "react";
import { m as motion } from "framer-motion";
import { MAX_ANSWER_LENGTH, type Answer, type ClarifyQuestion } from "@/lib/clarify-types";
import { IconCheck, IconSparkles } from "../icons";
import { Portal } from "../Portal";
import { useT } from "../app/Preferences";

/** Réponse à une question : une option choisie, ou « Passer » (null). */
type Choice = string | null | undefined;

/**
 * Assistant de questions : 2 à 3 questions courtes, réponses en boutons, « Passer » toujours disponible.
 * Aucune saisie obligatoire : « Concevoir » part même sans réponse.
 */
export function ClarifyPanel({
  prompt,
  questions,
  onSubmit,
  onCancel,
}: {
  prompt: string;
  questions: ClarifyQuestion[];
  onSubmit(answers: Answer[]): void;
  onCancel(): void;
}) {
  const t = useT();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const answerOf = (q: ClarifyQuestion): string | null => {
    const typed = texts[q.id]?.trim();
    if (typed && choices[q.id] !== null) return typed.slice(0, MAX_ANSWER_LENGTH);
    const choice = choices[q.id];
    return typeof choice === "string" ? choice : null;
  };
  const answered = questions.filter((q) => answerOf(q) !== null).length;

  const submit = () => {
    const answers: Answer[] = [];
    for (const q of questions) {
      const answer = answerOf(q);
      if (answer) answers.push({ question: q.question, answer });
    }
    onSubmit(answers);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-night/55 p-3 backdrop-blur-sm sm:items-center sm:p-6">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clarify-title"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-surface p-4 shadow-float sm:p-5"
        >
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-accent">
            <IconSparkles size={14} /> {t("clarify.kicker")}
          </p>
          <h2 id="clarify-title" className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
            « {prompt} »
          </h2>

          <div className="mt-3 space-y-4">
            {questions.map((q) => (
              <fieldset key={q.id}>
                <legend className="text-[13px] font-semibold text-ink">{q.question}</legend>
                {q.freeText && (
                  <input
                    type="text"
                    maxLength={MAX_ANSWER_LENGTH}
                    value={texts[q.id] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTexts((t) => ({ ...t, [q.id]: value }));
                      if (value.trim()) setChoices((c) => ({ ...c, [q.id]: undefined }));
                    }}
                    placeholder={q.freeText.placeholder}
                    aria-label={q.question}
                    className="input mt-2"
                  />
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.options.map((option) => {
                    const selected = choices[q.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setChoices((c) => ({ ...c, [q.id]: selected ? undefined : option }))}
                        className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition ${
                          selected
                            ? "border-brand-accent bg-brand-accent text-white"
                            : "border-line bg-paper text-ink-soft hover:border-brand-accent/50 hover:text-brand-accent"
                        }`}
                      >
                        {selected && <IconCheck size={12} strokeWidth={3} />}
                        {option}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={choices[q.id] === null}
                    onClick={() => setChoices((c) => ({ ...c, [q.id]: c[q.id] === null ? undefined : null }))}
                    className={`rounded-full border border-dashed px-3.5 py-2 text-[12.5px] font-medium transition ${
                      choices[q.id] === null ? "border-ink/40 bg-ink/10 text-ink" : "border-line text-ink-mute hover:text-ink"
                    }`}
                  >
                    {t("clarify.skip")}
                  </button>
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onCancel} className="btn-ghost !py-2.5 !text-xs">
              {t("clarify.edit")}
            </button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={() => onSubmit([])} className="btn-ghost !py-2.5 !text-xs">
                {t("clarify.skipAll")}
              </button>
              <button type="button" onClick={submit} className="btn-accent !py-2.5 !text-xs">
                <IconSparkles size={14} />
                {answered > 0 ? t("clarify.goN", { n: answered }) : t("clarify.go")}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
