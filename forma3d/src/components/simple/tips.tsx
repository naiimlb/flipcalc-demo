"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";

/*
 * Premier lancement : trois bulles au plus (une sur l'accueil, deux sur le résultat), fermables,
 * mémorisées sur l'appareil. Rien ne s'affiche tant que la mémoire n'a pas été lue (pas de clignotement).
 */
const KEY = "forma3d:tips";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Prochaine bulle non vue parmi `ids` (dans l'ordre), et la fonction pour la fermer. */
export function useTips(ids: readonly string[]): { id: string | null; dismiss(): void } {
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => setSeen(readSeen()), []);
  const id = seen ? (ids.find((x) => !seen.includes(x)) ?? null) : null;
  const dismiss = useCallback(() => {
    if (!id) return;
    const next = [...(seen ?? []), id];
    setSeen(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // mémoire indisponible : la bulle réapparaîtra, sans gravité
    }
  }, [id, seen]);
  return { id, dismiss };
}

/** Bulle d'aide : une phrase, un bouton « Compris ». */
export function Tip({ children, onDismiss }: { children: React.ReactNode; onDismiss(): void }) {
  return (
    <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/10 px-4 py-3 text-body text-ink">
      <p className="min-w-0 flex-1">{children}</p>
      <Button size="md" variant="secondary" onClick={onDismiss}>
        Compris
      </Button>
    </div>
  );
}
