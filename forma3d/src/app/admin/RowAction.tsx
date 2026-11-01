"use client";

import type { ActionResult } from "./actions";
import { ResultMessage, useSave } from "./useSave";

/** Bouton d'action serveur avec confirmation (suppression, changement de rôle…). */
export function RowAction({
  label,
  confirmText,
  action,
  tone = "default",
}: {
  label: string;
  confirmText?: string;
  action: () => Promise<ActionResult>;
  tone?: "default" | "danger";
}) {
  const { pending, result, run } = useSave();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => (!confirmText || confirm(confirmText)) && run(action)}
        className={`btn-ghost !px-3 !py-1 !text-xs ${tone === "danger" ? "!text-rose-600 hover:!border-rose-200" : ""}`}
      >
        {pending ? "…" : label}
      </button>
      {result && !result.ok && <ResultMessage result={result} />}
    </span>
  );
}
