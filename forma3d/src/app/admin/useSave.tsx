"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

/** Appelle une action serveur et garde le dernier message (succès / erreur). */
export function useSave() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      try {
        setResult(await action());
      } catch (err) {
        setResult({ ok: false, message: err instanceof Error ? err.message : "Erreur inattendue." });
      }
    });
  return { pending, result, run, setResult };
}

export function ResultMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <span role="status" className={`text-sm ${result.ok ? "text-emerald-600" : "text-rose-600"}`}>
      {result.message}
    </span>
  );
}
