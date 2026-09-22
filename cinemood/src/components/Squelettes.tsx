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
          <div className="squelette aspect-[2/3] w-full" />
          <div className="squelette mt-2.5 h-3 w-4/5 rounded-douce" />
          <div className="squelette mt-1.5 h-2.5 w-1/2 rounded-douce" />
        </div>
      ))}
    </div>
  );
}

/**
 * L'attente de l'accueil a la forme de l'accueil : un héros plein cadre,
 * puis deux carrousels. L'écran ne « saute » donc pas au moment où les
 * vraies données arrivent.
 */
export function SqueletteAccueil() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de ta sélection…</span>

      <div
        className="squelette relative min-h-[74svh] rounded-none"
        style={{ marginBottom: '1rem' }}
      >
        <div className="absolute inset-x-5 bottom-7 space-y-3">
          <div className="h-3 w-32 rounded-full bg-white/10" />
          <div className="h-9 w-4/5 rounded-douce bg-white/10" />
          <div className="h-3 w-2/5 rounded-full bg-white/10" />
          <div className="h-[50px] w-full rounded-douce bg-white/10" />
        </div>
      </div>

      {[0, 1].map((rangee) => (
        <div key={rangee} className="mt-8">
          <div className="px-5">
            <div className="squelette h-5 w-44" />
            <div className="squelette mt-2 h-3 w-28" />
          </div>
          <div className="mt-3.5">
            <SqueletteRangee />
          </div>
        </div>
      ))}
    </div>
  );
}
