"use client";

import { useEffect, useId } from "react";
import { motion } from "framer-motion";
import { Portal } from "../../Portal";
import { IconX } from "../../icons";
import { useT } from "../../app/Preferences";

/** Fenêtre de dialogue de l'éditeur : feuille en bas de l'écran sur iPhone, centrée sur iPad et Mac. */
export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose(): void; children: React.ReactNode; wide?: boolean }) {
  const t = useT();
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-night/55 p-2 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-h-[92dvh] w-full overflow-y-auto rounded-[24px] bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] text-ink shadow-float sm:p-5 ${wide ? "max-w-2xl" : "max-w-md"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={id} className="text-base font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={t("menu.close")} className="tap flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper">
              <IconX size={16} />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    </Portal>
  );
}

/** Petit champ numérique avec libellé et unité. */
export function NumInput({ label, value, onChange, unit, min, max, step = 1 }: { label: string; value: number; onChange(v: number): void; unit?: string; min?: number; max?: number; step?: number }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-ink-mute">{label}</span>
      <span className="flex items-center gap-1 rounded-xl bg-paper px-2.5 ring-1 ring-line focus-within:ring-neon-blue">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value.replace(",", ".")))}
          onKeyDown={(e) => e.stopPropagation()}
          className="h-10 w-full min-w-0 bg-transparent font-mono text-sm tabular-nums outline-none"
        />
        {unit && <span className="text-[11px] text-ink-mute">{unit}</span>}
      </span>
    </label>
  );
}

/** Choix exclusif compact (boutons pastilles). */
export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`tap flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${value === o.id ? "bg-fg text-canvas" : "text-ink-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
