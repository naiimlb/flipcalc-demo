/* =====================================================================
   Squelettes.tsx — États de chargement.
   ---------------------------------------------------------------------
   Règle du projet : jamais d'écran vide. Tant que les données arrivent,
   on montre la forme de ce qui va s'afficher — l'attente paraît plus
   courte et l'interface ne « saute » pas.
   ===================================================================== */

export function SqueletteCarte() {
  return (
    <div className="overflow-hidden rounded-carte verre">
      <div className="squelette aspect-[2/3] w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="squelette h-5 w-3/4" />
        <div className="squelette h-3 w-1/2" />
        <div className="squelette h-3 w-full" />
        <div className="squelette h-3 w-5/6" />
      </div>
    </div>
  );
}

export function SqueletteListe({ nombre = 3 }: { nombre?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de ta sélection…</span>
      {Array.from({ length: nombre }).map((_, i) => (
        <SqueletteCarte key={i} />
      ))}
    </div>
  );
}

export function SqueletteRangee({ nombre = 4 }: { nombre?: number }) {
  return (
    <div className="rail px-5" aria-busy="true">
      {Array.from({ length: nombre }).map((_, i) => (
        <div key={i} className="w-[132px] shrink-0">
          <div className="squelette aspect-[2/3] w-full rounded-douce" />
          <div className="squelette mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
