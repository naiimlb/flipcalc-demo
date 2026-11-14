"use client";

import { useEffect, useState } from "react";
import { IconCheck, Spinner } from "../icons";
import { GENERATION_STEPS, formatElapsed } from "./steps";
import { Button, Card } from "./ui";

/**
 * Écran d'attente : 4 étapes en clair, durée écoulée, temps habituel, « Annuler ».
 * Le titre et la première phrase d'analyse s'affichent dès que l'IA les a écrits.
 */
export function SimpleProgress({
  current,
  title,
  summary,
  startedAt,
  onCancel,
}: {
  current: number;
  title?: string;
  summary?: string;
  startedAt: number;
  onCancel(): void;
}) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Card className="w-full max-w-xl">
        <h1 className="text-title font-semibold text-ink">{title ?? "Je crée votre pièce…"}</h1>
        {summary && <p className="mt-2 text-body text-ink-soft">{summary}</p>}
        <ol className="mt-6 space-y-3" aria-label="Étapes de la création">
          {GENERATION_STEPS.map((label, i) => {
            const state = i < current ? "done" : i === current ? "active" : "todo";
            return (
              <li key={label} aria-current={state === "active" ? "step" : undefined} className={`flex items-center gap-3 text-lead ${state === "todo" ? "text-ink-mute" : "text-ink"}`}>
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${state === "done" ? "bg-success/15 text-success" : state === "active" ? "text-accent" : "border border-line"}`}
                >
                  {state === "done" ? <IconCheck size={18} /> : state === "active" ? <Spinner size={18} /> : null}
                </span>
                <span>
                  {label}
                  <span className="sr-only">{state === "done" ? " : terminé" : state === "active" ? " : en cours" : " : à venir"}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-body text-ink-mute" role="status">
          Cela prend en général 1 à 2 minutes. Déjà {formatElapsed(elapsed)}.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </Card>
    </main>
  );
}
