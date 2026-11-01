"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFS, type StudioPrefs } from "./types";

const KEY = "forma3d:prefs";

/** Préférences d'affichage, mémorisées dans ce navigateur uniquement. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<StudioPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<StudioPrefs>) });
    } catch {
      // Stockage indisponible (navigation privée) : valeurs par défaut.
    }
  }, []);

  const update = useCallback((patch: Partial<StudioPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignoré
      }
      return next;
    });
  }, []);

  return [prefs, update] as const;
}
