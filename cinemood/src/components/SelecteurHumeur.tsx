'use client';

/* =====================================================================
   SelecteurHumeur.tsx — « Tu es d'humeur à quoi ? »
   ---------------------------------------------------------------------
   Neuf grandes cartes, une couleur et une icône dessinée par humeur.
   Ces choix ne sont pas décoratifs : ils pilotent la table humeur ×
   contexte du moteur (src/lib/reco/poids.ts), et la couleur retenue
   repeint ensuite l'app entière (voir magasin.tsx).
   ===================================================================== */

import { motion } from 'framer-motion';

import { TABLE_COMPAGNIE, TABLE_HUMEURS } from '@/lib/reco/poids';
import { IDENTITE_HUMEUR } from '@/lib/ui/humeurs';
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
      <div className="px-5">
        <p className="etiquette">Ce soir</p>
        <h2 className="mt-2 text-[1.6rem] leading-tight text-ivoire">Tu es d’humeur à quoi ?</h2>
      </div>

      <div className="cascade mt-5 grid grid-cols-2 gap-3 px-5">
        {HUMEURS.map((cle, index) => {
          const reglage = TABLE_HUMEURS[cle];
          const identite = IDENTITE_HUMEUR[cle];
          const actif = humeur === cle;
          return (
            <motion.button
              key={cle}
              type="button"
              whileTap={{ scale: 0.965 }}
              onClick={() => onHumeur(actif ? null : cle)}
              aria-pressed={actif}
              style={
                {
                  '--i': index,
                  '--accent': identite.accent,
                  '--second': identite.second,
                } as React.CSSProperties
              }
              className={`relative isolate flex min-h-[118px] flex-col justify-between gap-3 overflow-hidden rounded-carte border p-4 text-left text-ivoire ${
                actif ? 'border-accent shadow-halo' : 'border-accent/45'
              }`}
            >
              {/* Fond dégradé, halo débordant du coin, puis voile sombre en
                  pied : sur un accent clair (jaune, or), du blanc seul
                  passerait sous le seuil de contraste. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-encre bg-gradient-to-br from-accent/40 via-second/20 to-white/[0.02]"
              />
              <span
                aria-hidden="true"
                className="absolute -right-12 -top-14 -z-10 h-[150px] w-[150px] rounded-full opacity-55"
                style={{ background: 'radial-gradient(circle, rgb(var(--accent) / 0.85) 0%, transparent 70%)' }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-gradient-to-b from-transparent to-nuit/55"
              />

              {actif && (
                <span className="absolute right-3.5 top-3.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-nuit">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                </span>
              )}

              <svg
                viewBox="0 0 24 24"
                className="h-[30px] w-[30px] text-white drop-shadow-[0_3px_10px_rgba(6,4,11,0.55)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={identite.icone} />
              </svg>

              <span className="block">
                <span className="block font-affiche text-[17px] font-semibold uppercase leading-none tracking-[0.02em]">
                  {reglage.libelle}
                </span>
                <span className="mt-1 block text-[12px] leading-snug text-ivoire/[0.88]">
                  {reglage.genres.slice(0, 2).join(' · ')}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-7 px-5">
        <h3 className="text-[1.1rem] text-ivoire">Avec qui ?</h3>
        <div className="mt-3.5 flex gap-2">
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
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-full border px-2 text-[13px] transition-colors ${
                  actif
                    ? 'border-accent/85 bg-accent/[0.18] text-ivoire'
                    : 'border-white/[0.11] bg-white/[0.04] text-cendre'
                }`}
              >
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
