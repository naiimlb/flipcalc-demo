'use client';

/* =====================================================================
   Affiche.tsx — L'affiche d'un titre, en grand format.
   ---------------------------------------------------------------------
   Deux cas :
     • avec TMDB configuré, on affiche la vraie affiche via next/image
       (redimensionnée et servie en AVIF/WebP, donc légère en 4G) ;
     • sans TMDB (mode démo), on compose une affiche typographique
       déterministe. Le dégradé et la teinte découlent du titre lui-même,
       donc un même film a toujours la même affiche. Mieux vaut une
       composition assumée qu'un rectangle gris cassé.
   ===================================================================== */

import Image from 'next/image';
import { useMemo, useState } from 'react';

import type { Titre } from '@/lib/reco/types';

interface Props {
  titre: Titre;
  /** `couverture` = grande carte, `vignette` = liste ou grille. */
  variante?: 'couverture' | 'vignette';
  priorite?: boolean;
  className?: string;
}

/** Empreinte stable : le même titre donne toujours la même couleur. */
function empreinte(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function Affiche({ titre, variante = 'vignette', priorite = false, className = '' }: Props) {
  const [enEchec, setEnEchec] = useState(false);
  const url = titre.affiche
    ? `https://image.tmdb.org/t/p/${variante === 'couverture' ? 'w780' : 'w342'}${titre.affiche}`
    : null;

  const composition = useMemo(() => {
    const graine = empreinte(titre.id + titre.titre);
    const teinte = graine % 360;
    // Duotone franc plutôt qu'un gris teinté : sans vraie affiche, c'est
    // la couleur qui doit porter l'écran. Une tache lumineuse en haut,
    // le noir qui reprend le dessous.
    return {
      fond: `radial-gradient(90% 60% at 22% 8%, hsl(${teinte} 85% 46% / 0.95) 0%, transparent 62%),
        linear-gradient(152deg,
          hsl(${teinte} 72% 30%) 0%,
          hsl(${(teinte + 38) % 360} 68% 17%) 52%,
          hsl(${(teinte + 66) % 360} 60% 8%) 100%)`,
      trait: `hsl(${teinte} 90% 70%)`,
      initiale: (titre.titre.match(/\p{L}/u)?.[0] ?? '?').toUpperCase(),
    };
  }, [titre.id, titre.titre]);

  const grand = variante === 'couverture';

  if (url && !enEchec) {
    return (
      <div className={`relative overflow-hidden bg-ardoise ${className}`}>
        <Image
          src={url}
          alt={`Affiche de ${titre.titre}`}
          fill
          sizes={grand ? '(max-width: 640px) 92vw, 420px' : '(max-width: 640px) 40vw, 200px'}
          className="object-cover"
          priority={priorite}
          onError={() => setEnEchec(true)}
        />
      </div>
    );
  }

  // --- Affiche composée (mode démo ou image manquante) ----------------
  return (
    <div
      className={`grain relative overflow-hidden bg-ardoise ${className}`}
      style={{ background: composition.fond }}
      role="img"
      aria-label={`Affiche de ${titre.titre}`}
    >
      {/* Faute de vraie affiche, l'initiale du titre tient lieu de motif :
          deux titres voisins ne se ressemblent plus. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1 font-affiche font-bold leading-none text-white/[0.14] ${
          grand ? '-bottom-12 text-[190px]' : '-bottom-4 text-[96px]'
        }`}
      >
        {composition.initiale}
      </span>

      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div
          className="h-0.5 w-9 rounded-full opacity-90"
          style={{ background: composition.trait }}
        />
        <div className="relative">
          <p
            className={`equilibre lignes-3 font-affiche font-semibold leading-[1.04] text-ivoire ${
              grand ? 'text-[2rem]' : 'text-[1.05rem]'
            }`}
          >
            {titre.titre}
          </p>
          <p className={`mt-1.5 font-texte uppercase tracking-[0.2em] text-ivoire/60 ${grand ? 'text-xs' : 'text-[10px]'}`}>
            {titre.annee} · {titre.type === 'film' ? 'FILM' : 'SÉRIE'}
          </p>
        </div>
      </div>
    </div>
  );
}
