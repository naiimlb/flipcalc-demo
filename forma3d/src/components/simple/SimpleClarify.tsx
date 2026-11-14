"use client";

import { useState } from "react";
import type { Answer, ClarifyQuestion } from "@/lib/clarify-types";
import { IconArrowLeft } from "../icons";
import { Button, Card } from "./ui";

/**
 * Précisions : une question à la fois, réponses en boutons (ou une réponse libre), toujours « Passer ».
 * Au plus 3 questions ; au plus 5 réponses + 2 actions à l'écran.
 */
export function SimpleClarify({
  prompt,
  questions,
  onDone,
  onEdit,
}: {
  prompt: string;
  questions: ClarifyQuestion[];
  /** Réponses données (vide si l'on passe). */
  onDone(answers: Answer[]): void;
  onEdit(): void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [free, setFree] = useState("");
  const q = questions[index];

  const answer = (text: string) => {
    const value = text.trim();
    const next = value ? [...answers.filter((a) => a.question !== q.question), { question: q.question, answer: value.slice(0, 120) }] : answers;
    setAnswers(next);
    setFree("");
    if (index + 1 >= questions.length) onDone(next);
    else setIndex(index + 1);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Card className="w-full max-w-xl">
        <p className="text-body text-ink-mute">
          Question {index + 1} sur {questions.length}
        </p>
        <p className="mt-1 text-body text-ink-soft">« {prompt.length > 90 ? `${prompt.slice(0, 90)}…` : prompt} »</p>
        <h1 className="mt-4 text-title font-semibold text-ink">{q.question}</h1>
        {q.options.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {q.options.map((option) => (
              <li key={option}>
                <Button onClick={() => answer(option)}>{option}</Button>
              </li>
            ))}
          </ul>
        )}
        {q.freeText && (
          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              answer(free);
            }}
          >
            <label className="sr-only" htmlFor="simple-free">
              Votre réponse
            </label>
            <input
              id="simple-free"
              value={free}
              onChange={(e) => setFree(e.target.value)}
              maxLength={120}
              placeholder={q.freeText.placeholder}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-mute focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <Button type="submit" variant="primary">
              Continuer
            </Button>
          </form>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
          <Button variant="subtle" onClick={onEdit}>
            <IconArrowLeft size={20} /> Modifier ma demande
          </Button>
          <Button variant="subtle" onClick={() => onDone(answers)}>
            Passer, générer directement
          </Button>
        </div>
      </Card>
    </main>
  );
}
