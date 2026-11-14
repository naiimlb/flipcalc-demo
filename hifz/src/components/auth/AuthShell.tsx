import type { ReactNode } from "react";

/** Cadre commun aux écrans d'identification : titre, sobre, sans barre d'onglets. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[85dvh] max-w-md flex-col justify-center py-10">
      <div className="mb-8 text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 grid size-16 place-items-center rounded-[22px] bg-accent text-on-accent"
        >
          {/* Rosace à huit branches, comme l'icône de l'app. */}
          <svg viewBox="0 0 512 512" width="40" height="40" fill="currentColor">
            <rect x="126" y="126" width="260" height="260" rx="10" />
            <rect x="126" y="126" width="260" height="260" rx="10" transform="rotate(45 256 256)" />
            <circle cx="256" cy="256" r="86" fill="var(--accent)" />
            <circle cx="256" cy="256" r="58" fill="none" stroke="currentColor" strokeWidth="14" />
          </svg>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </main>
  );
}

export const fieldClass =
  "min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none focus:border-accent";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[15px] font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}
