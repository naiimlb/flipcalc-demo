import type { ReactNode } from "react";

/** Tuile de statistique : libellé, valeur, et pictogramme facultatif. */
export function StatTile({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="glass flex flex-col gap-1 rounded-3xl px-4 py-3">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        {icon}
        {label}
      </span>
      <span className="text-[24px] font-extrabold leading-tight tabular-nums">{value}</span>
    </div>
  );
}

export const FlameIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500" fill="currentColor" aria-hidden>
    <path d="M12 2c1 3.5 5 5.6 5 10.5A5 5 0 0 1 12 18a5 5 0 0 1-5-5.2c0-2 1-3.3 2-4.3.3 1.6 1 2.6 2 3 0-3.5-.6-6.4 1-9.5Z" />
    <path d="M12 22a7 7 0 0 0 7-7c0 2.8-3 5-7 5s-7-2.2-7-5a7 7 0 0 0 7 7Z" opacity=".5" />
  </svg>
);
