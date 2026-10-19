"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteTajweedAttempt, deleteTajweedPassage } from "@/app/(app)/tajweed/actions";
import { Sheet } from "../Sheet";
import { Button, Notice } from "../ui";

type Props =
  | { kind: "attempt"; id: string; label: string }
  | { kind: "passage"; passageKey: string; label: string };

/** Suppression avec confirmation (un essai ou tout un passage). */
export function DeleteButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res =
      props.kind === "attempt"
        ? await deleteTajweedAttempt(props.id).catch(() => ({ ok: false }))
        : await deleteTajweedPassage(props.passageKey).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) return setError("Suppression impossible. Vérifie ta connexion et réessaie.");
    setOpen(false);
    if (props.kind === "passage") router.push("/tajweed/parcours");
    router.refresh();
  }

  return (
    <>
      {props.kind === "attempt" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable grid h-11 w-11 place-items-center rounded-full text-muted active:bg-rose-500/10"
          aria-label={props.label}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)}>
          {props.label}
        </Button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} label="Confirmer la suppression">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">
            {props.kind === "attempt" ? "Supprimer cet essai ?" : "Supprimer ce passage ?"}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted">
            {props.kind === "attempt"
              ? "Cet essai disparaîtra de ton parcours. Cette action est définitive."
              : "Tous les essais de ce passage seront supprimés. Cette action est définitive."}
          </p>
          {error && <Notice tone="error">{error}</Notice>}
          <Button variant="danger" loading={busy} onClick={confirm}>
            Supprimer
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </div>
      </Sheet>
    </>
  );
}
