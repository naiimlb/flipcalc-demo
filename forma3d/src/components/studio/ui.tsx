"use client";

import { useState } from "react";
import { AnimatePresence, m as motion, useReducedMotion } from "framer-motion";
import type { RequestStatus } from "@/lib/requests";
import { useT } from "../app/Preferences";
import { IconAlert, IconCheck, IconMinus, IconPlus, Spinner } from "../icons";

export function StatusChip({ status, compact = false }: { status: RequestStatus; compact?: boolean }) {
  const t = useT();
  if (status === "ready") {
    return (
      <span className="chip bg-brand-accent text-white">
        <IconCheck size={12} strokeWidth={2.6} />
        {!compact && t("status.ready")}
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="chip bg-brand-accent/10 text-brand-accent">
        <Spinner size={11} />
        {!compact && t("status.processing")}
      </span>
    );
  }
  return (
    <span className="chip bg-danger/15 text-danger">
      <IconAlert size={12} strokeWidth={2.4} />
      {!compact && t("status.error")}
    </span>
  );
}

/** Panneau repliable (colonne droite / gauche du tableau de bord). */
export function Panel({
  icon,
  title,
  defaultOpen = true,
  aside,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-start"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-ink">{title}</span>
        {aside}
        <span className="text-ink-mute">{open ? <IconMinus size={14} /> : <IconPlus size={14} />}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            <div className="px-3.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Sous-carte « libellé : valeur » (comme les fiches du tableau de bord). */
export function Field({ label, children, tone = "default" }: { label: string; children: React.ReactNode; tone?: "default" | "accent" }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-mute">{label}</p>
      <div className={`text-sm leading-snug ${tone === "accent" ? "font-semibold text-brand-accent" : "text-ink"}`}>
        {children}
      </div>
    </div>
  );
}

export function BulletList({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-xs text-ink-mute">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-ink-soft">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-brand-accent" : "bg-ink/15"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

/** Fait apparaître les panneaux l'un après l'autre quand une conception vient d'arriver (désactivé si « réduire les animations »). */
export function Reveal({ index, on, children }: { index: number; on?: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (!on || reduced) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.16, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
