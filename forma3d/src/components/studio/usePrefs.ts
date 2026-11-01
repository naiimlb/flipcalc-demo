"use client";

import { useCallback, useEffect, useState } from "react";
import type { LengthUnit } from "./format";
import { DEFAULT_PREFS, type StudioPrefs } from "./types";

const KEY = "forma3d:prefs";

/** Préférences d'affichage, mémorisées dans ce navigateur uniquement. */
export function usePrefs(accountUnit?: LengthUnit) {
  const [prefs, setPrefs] = useState<StudioPrefs>({ ...DEFAULT_PREFS, unit: accountUnit ?? DEFAULT_PREFS.unit });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const stored = raw ? (JSON.parse(raw) as Partial<StudioPrefs>) : {};
      // L'unité du compte (synchronisée entre appareils) prime sur celle du navigateur.
      setPrefs({ ...DEFAULT_PREFS, ...stored, ...(accountUnit ? { unit: accountUnit } : {}) });
    } catch {
      // Stockage indisponible (navigation privée) : valeurs par défaut.
    }
  }, [accountUnit]);

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
