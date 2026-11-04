"use client";

import { useEffect, useId } from "react";
import { m as motion } from "framer-motion";
import { Portal } from "../../Portal";
import { IconX } from "../../icons";
import { useT } from "../../app/Preferences";
import { NumberField } from "../../ui/NumberField";

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
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-night/40 p-2 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-h-[92dvh] w-full overflow-y-auto rounded-lg border border-line bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] text-ink shadow-float ${wide ? "max-w-2xl" : "max-w-md"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={id} className="text-base font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={t("menu.close")} className="icon-btn tap">
              <IconX size={16} />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    </Portal>
  );
}

/** Petit champ numérique avec libellé (à glisser pour ajuster) et unité. */
export function NumInput({ label, value, onChange, unit, min, max, step = 1 }: { label: string; value: number; onChange(v: number): void; unit?: string; min?: number; max?: number; step?: number }) {
  return <NumberField layout="stacked" label={label} value={Number.isFinite(value) ? value : 0} onCommit={onChange} unit={unit} min={min} max={max} step={step} />;
}

/** Choix exclusif compact (boutons pastilles). */
export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-0.5 rounded-md border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`tap flex-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${value === o.id ? "bg-surface text-ink ring-1 ring-line" : "text-ink-mute hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
