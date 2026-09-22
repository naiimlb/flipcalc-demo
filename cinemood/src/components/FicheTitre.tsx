'use client';

/* =====================================================================
   FicheTitre.tsx — La fiche ouverte depuis un carrousel.
   ---------------------------------------------------------------------
   Toucher une affiche ne doit pas mener à un cul-de-sac : la fiche
   reprend la carte complète, donc le « Pourquoi pour toi » et les
   quatre gestes d'apprentissage — ce sont eux qui font le produit.
   ===================================================================== */

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

import { CarteRecommandation } from './CarteRecommandation';
import type { Recommandation, Signal } from '@/lib/reco/types';

interface Props {
  reco: Recommandation | null;
  plateformesUtilisateur: string[];
  dansLaListe: boolean;
  onFermer: () => void;
  onBandeAnnonce: () => void;
  onSignal: (signal: Signal) => void;
}

export function FicheTitre({
  reco,
  plateformesUtilisateur,
  dansLaListe,
  onFermer,
  onBandeAnnonce,
  onSignal,
}: Props) {
  // Le fond ne doit pas défiler derrière la fiche, et Échap doit fermer.
  useEffect(() => {
    if (!reco) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', auClavier);
    return () => {
      document.body.style.overflow = precedent;
      window.removeEventListener('keydown', auClavier);
    };
  }, [reco, onFermer]);

  return (
    <AnimatePresence>
      {reco && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[55] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={reco.titre.titre}
        >
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer la fiche"
            className="absolute inset-0 bg-[rgb(3_2_7_/_0.78)]"
          />

          <motion.div
            initial={{ y: 26 }}
            animate={{ y: 0 }}
            exit={{ y: 26 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative max-h-[92svh] w-full max-w-xl overflow-y-auto px-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            <button
              type="button"
              onClick={onFermer}
              aria-label="Fermer"
              className="sticky top-2.5 z-10 mb-2.5 ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-nuit/80 text-ivoire"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <CarteRecommandation
              reco={reco}
              plateformesUtilisateur={plateformesUtilisateur}
              dansLaListe={dansLaListe}
              onBandeAnnonce={onBandeAnnonce}
              onSignal={onSignal}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
