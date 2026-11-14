"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "../icons";

/*
 * Composants du parcours Simple. Tailles : body 16, lead 18, title 24, hero 36.
 * Cibles tactiles ≥ 44 px (48 px pour l'action principale). Tout passe par les variables de .simple-ui.
 */

type ButtonVariant = "primary" | "secondary" | "subtle";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent-strong text-white hover:bg-accent-strong/90 active:bg-accent-strong/80",
  secondary: "border border-line bg-surface text-ink hover:bg-paper active:bg-line/60",
  subtle: "text-ink-soft hover:bg-paper hover:text-ink active:bg-line/60",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "lg"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 text-body font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 ${
        size === "lg" ? "min-h-12 px-5 text-lead" : "min-h-11"
      } ${BUTTON_STYLES[variant]} ${className}`}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

/** Curseur : valeur affichée en clair, zone de glisse de 44 px, valeur lue à voix haute avec son unité. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "mm",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange(value: number): void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-body">
        <span className="text-ink-soft">{label}</span>
        <span className="font-medium tabular-nums text-ink">
          {value} {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value} ${unit === "mm" ? "millimètres" : unit}`}
        className="mt-1 h-11 w-full cursor-pointer accent-[rgb(var(--accent))]"
      />
    </div>
  );
}

/** Onglets accessibles : flèches gauche/droite, un seul onglet dans l'ordre de tabulation. */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange(id: T): void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl bg-paper p-1">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const next = (i + step + tabs.length) % tabs.length;
            onChange(tabs[next].id);
            refs.current[next]?.focus();
          }}
          className="min-h-11 flex-1 rounded-lg px-3 text-body font-medium text-ink-mute transition-colors hover:text-ink aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-sm"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Boîte de dialogue native (<dialog>) : focus piégé, Échap pour fermer, fond inerte. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-title font-semibold">
          {title}
        </h2>
        <div className="mt-3 text-body text-ink-soft">{children}</div>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </dialog>
  );
}

/** Messages brefs (« Fichier téléchargé ») : annoncés par les lecteurs d'écran, disparaissent seuls. */
type Toast = { id: number; text: string };
const ToastContext = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <p key={t.id} className="rounded-xl bg-night px-4 py-3 text-body text-white shadow-float">
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
