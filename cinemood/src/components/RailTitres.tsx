'use client';

/* =====================================================================
   RailTitres.tsx — Un carrousel d'affiches.
   ---------------------------------------------------------------------
   Les vignettes apparaissent en cascade (40 ms d'écart) et réagissent au
   toucher par un léger enfoncement et une ombre colorée. Tout est en
   `transform` et `opacity` : rien qui force un recalcul de mise en page
   pendant le défilement.
   ===================================================================== */

import { motion } from 'framer-motion';

import { Affiche } from './Affiche';
import type { Recommandation } from '@/lib/reco/types';

interface Props {
  titre: string;
  sousTitre: string;
  recos: Recommandation[];
  onChoisir: (reco: Recommandation) => void;
}

export function RailTitres({ titre, sousTitre, recos, onChoisir }: Props) {
  if (recos.length === 0) return null;

  return (
    <section className="mt-9" aria-label={titre}>
      <div className="mb-3.5 px-5">
        {/* Titre et sous-titre empilés : côte à côte, un titre long
            finissait sur trois lignes serrées. */}
        <h2 className="lignes-2 text-[19px] tracking-[0.015em] text-ivoire">{titre}</h2>
        <span className="mt-1 block text-[12.5px] text-estompe">{sousTitre}</span>
      </div>

      <div className="rail cascade px-5">
        {recos.map((reco, index) => {
          const format =
            reco.titre.type === 'film'
              ? reco.titre.duree
                ? `${Math.floor(reco.titre.duree / 60)} h ${String(reco.titre.duree % 60).padStart(2, '0')}`
                : 'Film'
              : reco.titre.saisons
                ? `${reco.titre.saisons} saison${reco.titre.saisons > 1 ? 's' : ''}`
                : 'Série';

          return (
            <motion.button
              key={reco.titre.id}
              type="button"
              whileTap={{ scale: 0.955 }}
              onClick={() => onChoisir(reco)}
              style={{ '--i': index } as React.CSSProperties}
              className="group w-[132px] shrink-0 text-left"
            >
              <Affiche
                titre={reco.titre}
                className="aspect-[2/3] w-full rounded-carte shadow-carte transition-shadow group-active:shadow-halo"
              />
              <p className="lignes-2 mt-2.5 text-[13px] font-medium leading-snug text-ivoire">{reco.titre.titre}</p>
              <p className="mt-0.5 text-[11.5px] text-estompe">
                {reco.titre.annee} · {format}
              </p>
            </motion.button>
          );
        })}
        <div className="w-1.5 shrink-0" aria-hidden="true" />
      </div>
    </section>
  );
}
