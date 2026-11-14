import type { StateTotals } from "@/lib/stats";

/** Barre fine : acquis (teinte pleine), en cours (pas plus clair), le reste = nouveaux. */
export function ProgressBar({ totals, className = "" }: { totals: StateTotals; className?: string }) {
  const pct = (n: number) => (totals.total ? (n / totals.total) * 100 : 0);
  return (
    <div
      role="img"
      aria-label={`${totals.mastered} acquis et ${totals.learning} en cours sur ${totals.total} versets`}
      className={`flex h-2 gap-[2px] overflow-hidden rounded-full bg-line ${className}`}
    >
      {totals.mastered > 0 ? <div className="rounded-full bg-accent" style={{ width: `${pct(totals.mastered)}%` }} /> : null}
      {totals.learning > 0 ? <div className="rounded-full bg-accent/40" style={{ width: `${pct(totals.learning)}%` }} /> : null}
    </div>
  );
}

/** Légende des états (l'identité ne repose jamais sur la couleur seule). */
export function StateLegend({ totals }: { totals: StateTotals }) {
  const item = (swatch: string, label: string, n: number) => (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 rounded-full ${swatch}`} aria-hidden="true" />
      <span className="tabular-nums text-ink">{n}</span> {label}
    </li>
  );
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {item("bg-accent", "acquis", totals.mastered)}
      {item("bg-accent/40", "en cours", totals.learning)}
      {item("bg-line", totals.new > 1 ? "nouveaux" : "nouveau", totals.new)}
    </ul>
  );
}
