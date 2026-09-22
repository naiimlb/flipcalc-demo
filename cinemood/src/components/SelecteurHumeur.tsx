'use client';

/* =====================================================================
   SelecteurHumeur.tsx — « Quelle est ton humeur ce soir ? »
   ---------------------------------------------------------------------
   Sélection visuelle en une ligne qui défile, plus le choix « avec qui ».
   Ces deux réponses changent réellement la sélection : elles pilotent la
   table humeur × contexte du moteur (src/lib/reco/poids.ts).
   ===================================================================== */

import { motion } from 'framer-motion';

import { TABLE_COMPAGNIE, TABLE_HUMEURS } from '@/lib/reco/poids';
import type { Compagnie, Humeur } from '@/lib/reco/types';

const HUMEURS = Object.keys(TABLE_HUMEURS) as Humeur[];
const COMPAGNIES: Compagnie[] = ['seul', 'couple', 'potes', 'famille'];

interface Props {
  humeur: Humeur | null;
  compagnie: Compagnie;
  onHumeur: (humeur: Humeur | null) => void;
  onCompagnie: (compagnie: Compagnie) => void;
}

export function SelecteurHumeur({ humeur, compagnie, onHumeur, onCompagnie }: Props) {
  return (
    <section aria-label="Humeur et contexte">
      <h2 className="px-5 font-titre text-[1.55rem] leading-tight text-ivoire">
        Quelle est ton humeur ce soir ?
      </h2>

      <div className="rail mt-4 pb-1">
        {HUMEURS.map((cle) => {
          const reglage = TABLE_HUMEURS[cle];
          const actif = humeur === cle;
          return (
            <motion.button
              key={cle}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onHumeur(actif ? null : cle)}
              aria-pressed={actif}
              className={`flex w-[92px] shrink-0 snap-start flex-col items-center gap-2 rounded-carte border px-2 py-3.5 transition-colors ${
                actif ? 'border-or/60 bg-or/12' : 'border-white/[0.07] bg-white/[0.03]'
              }`}
            >
              <span className="text-[26px] leading-none" aria-hidden="true">
                {reglage.emoji}
              </span>
              <span
                className={`text-center text-[12px] leading-tight ${actif ? 'text-orClair' : 'text-cendre'}`}
              >
                {reglage.libelle}
              </span>
            </motion.button>
          );
        })}
        <div className="w-2 shrink-0" aria-hidden="true" />
      </div>

      <div className="mt-5 px-5">
        <p className="mb-2.5 text-[13px] text-estompe">Avec qui ?</p>
        <div className="flex gap-2">
          {COMPAGNIES.map((cle) => {
            const reglage = TABLE_COMPAGNIE[cle];
            const actif = compagnie === cle;
            return (
              <motion.button
                key={cle}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onCompagnie(cle)}
                aria-pressed={actif}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border px-2 text-[13px] transition-colors ${
                  actif ? 'border-or/60 bg-or/12 text-orClair' : 'border-white/[0.07] text-cendre'
                }`}
              >
                <span aria-hidden="true">{reglage.emoji}</span>
                <span className="truncate">{reglage.libelle}</span>
              </motion.button>
            );
          })}
        </div>
        {compagnie === 'famille' && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-estompe">
            En famille, CinéMood ne propose que des titres tout public.
          </p>
        )}
      </div>
    </section>
  );
}
