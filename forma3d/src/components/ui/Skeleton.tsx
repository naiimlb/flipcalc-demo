/** Blocs de chargement (squelettes) et état vide : même rendu partout, lisibles par les lecteurs d'écran. */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-xl ${className}`} />;
}

/** Lignes de texte en attente (largeurs variées pour un rendu naturel). */
export function SkeletonLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3"];
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

/** Zone en cours de chargement : annonce « Chargement… » aux lecteurs d'écran, sans bruit visuel. */
export function LoadingRegion({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** État vide : une phrase qui explique, et une action quand elle existe. */
export function EmptyState({ icon, title, hint, action, className = "" }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-6 text-center ${className}`}>
      {icon && (
        <span aria-hidden className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-neon-blue/10 text-neon-blue">
          {icon}
        </span>
      )}
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-[16rem] text-xs leading-snug text-ink-mute">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
