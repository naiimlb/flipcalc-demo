"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptTajweedNotice } from "@/app/(app)/tajweed/actions";
import { Button, Notice } from "../ui";
import { NoticeText } from "./NoticeText";

/** Écran plein format affiché au premier accès à l'onglet Tajweed. */
export function NoticeGate() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setSaving(true);
    setError(null);
    const { ok } = await acceptTajweedNotice().catch(() => ({ ok: false }));
    setSaving(false);
    if (!ok) return setError("Impossible d'enregistrer ton choix. Vérifie ta connexion et réessaie.");
    router.refresh();
  }

  return (
    <main className="notice-gate pb-safe mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-6">
      <div className="glass animate-rise flex flex-1 flex-col rounded-[28px] p-6">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-emerald/25" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7.5c3-1.2 6-1 9 1.2 3-2.2 6-2.4 9-1.2V19c-3-1.2-6-1-9 1.2C9 18 6 17.8 3 19V7.5Z" />
            <path d="M12 8.7v11.5" />
          </svg>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight">Avant de commencer</h1>
        <div className="mt-4 flex-1">
          <NoticeText />
        </div>
        <label className="mt-6 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl bg-bg/70 px-4 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[#059669]"
          />
          <span className="text-[16px] font-semibold">J&apos;ai compris</span>
        </label>
        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <Button className="mt-4" disabled={!checked} loading={saving} onClick={onContinue}>
          Continuer
        </Button>
      </div>
      <div className="h-6 shrink-0" aria-hidden />
    </main>
  );
}
