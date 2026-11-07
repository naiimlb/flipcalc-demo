"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { QuranDataError } from "@/lib/quran/loader";
import type { SurahData } from "@/lib/quran/types";
import { getDb, getSurahLoader } from "@/lib/storage/client";

export function useCards() {
  return useLiveQuery(() => getDb().cards.orderBy("rank").toArray(), []);
}

export function usePrograms() {
  return useLiveQuery(() => getDb().programs.orderBy("seq").toArray(), []);
}

/** Jour de chaque révision du journal (pour la série et la régularité). */
export function useReviewDays() {
  return useLiveQuery(async () => (await getDb().reviews.toArray()).map((r) => r.day), []);
}

type SurahState =
  | { status: "loading" }
  | { status: "ready"; data: SurahData }
  | { status: "error"; message: string; offline: boolean };

/** Charge une sourate (cache local d'abord) avec gestion d'erreur et nouvel essai. */
export function useSurah(number: number | null) {
  const [state, setState] = useState<{ number: number | null; value: SurahState }>({
    number,
    value: { status: "loading" },
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (number === null) return;
    let alive = true;
    getSurahLoader()
      .load(number)
      .then((data) => alive && setState({ number, value: { status: "ready", data } }))
      .catch((error: unknown) => {
        if (!alive) return;
        const message = error instanceof Error ? error.message : "Erreur inconnue.";
        const offline = error instanceof QuranDataError && error.kind === "offline";
        setState({ number, value: { status: "error", message, offline } });
      });
    return () => {
      alive = false;
    };
  }, [number, attempt]);

  const retry = useCallback(() => {
    setState({ number, value: { status: "loading" } });
    setAttempt((a) => a + 1);
  }, [number]);

  // Tant que l'effet n'a pas répondu pour cette sourate, on est en chargement.
  const value: SurahState = state.number === number ? state.value : { status: "loading" };
  return { ...value, retry };
}
