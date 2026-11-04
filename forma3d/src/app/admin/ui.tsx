/** Briques d'interface de l'espace admin (composants serveur). */
export function AdminTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-brand-accent text-white",
    processing: "bg-brand-accent/10 text-brand-accent",
    error: "bg-danger/15 text-danger",
  };
  const labels: Record<string, string> = { ready: "Prête", processing: "En cours", error: "Erreur" };
  return <span className={`chip ${styles[status] ?? "bg-paper text-ink-soft"}`}>{labels[status] ?? status}</span>;
}
