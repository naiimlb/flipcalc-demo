'use client';

/* =====================================================================
   PastillePlateforme.tsx — Marqueur de plateforme.
   ---------------------------------------------------------------------
   On n'embarque AUCUN logo de marque : ce sont des pastilles colorées
   portant les initiales du service. C'est net, léger, et cela évite
   d'utiliser des marques déposées sans autorisation.
   ===================================================================== */

import { PLATEFORME_PAR_ID } from '@/lib/reco/plateformes';

interface Props {
  id: string;
  taille?: 'petite' | 'moyenne' | 'grande';
  avecNom?: boolean;
}

export function PastillePlateforme({ id, taille = 'moyenne', avecNom = false }: Props) {
  const plateforme = PLATEFORME_PAR_ID[id];
  if (!plateforme) return null;

  const dimensions = {
    petite: 'h-6 min-w-6 text-[9px] px-1.5',
    moyenne: 'h-8 min-w-8 text-[11px] px-2',
    grande: 'h-11 min-w-11 text-[13px] px-2.5',
  }[taille];

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center rounded-[9px] font-semibold uppercase tracking-wide text-white shadow-flottant ring-1 ring-white/15 ${dimensions}`}
        style={{ backgroundColor: plateforme.couleur }}
        aria-hidden="true"
      >
        {plateforme.initiales || plateforme.nom.slice(0, 2)}
      </span>
      {avecNom && <span className="text-sm text-cendre">{plateforme.nom}</span>}
      <span className="sr-only">{plateforme.nom}</span>
    </span>
  );
}
