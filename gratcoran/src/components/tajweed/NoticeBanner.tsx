"use client";

import { useState } from "react";
import { Sheet } from "../Sheet";
import { NoticeText } from "./NoticeText";

/** Bandeau discret et permanent en haut de l'écran Tajweed. */
export function NoticeBanner() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center gap-2.5 rounded-2xl bg-amber-500/10 px-4 py-2.5 text-left text-[14px] font-medium text-amber-900 dark:text-amber-100"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        Outil d&apos;entraînement indicatif — touche pour en savoir plus
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Avertissement Tajweed">
        <h2 className="mb-3 text-xl font-bold tracking-tight">Avant de commencer</h2>
        <NoticeText />
      </Sheet>
    </>
  );
}
