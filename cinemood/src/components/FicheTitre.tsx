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

import { FicheDetail } from './FicheDetail';
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
  //
  // `overflow: hidden` sur `body` ne suffit PAS sur Safari iOS : il ne
  // bloque pas fiablement le défilement de la page en dessous, et le
  // geste de balayage démarré sur la fiche peut alors être capté par la
  // page de fond au lieu de faire défiler la fiche elle-même — elle
  // semble alors coincée, figée sur ce qui était visible à l'ouverture.
  // La technique fiable, standard sur iOS : figer le corps en
  // `position: fixed` à son décalage de scroll actuel, et le restaurer
  // à la fermeture.
  useEffect(() => {
    if (!reco) return;
    const decalage = window.scrollY;
    const { style } = document.body;
    const precedent = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
      overflow: style.overflow,
    };
    style.position = 'fixed';
    style.top = `-${decalage}px`;
    style.left = '0';
    style.right = '0';
    style.width = '100%';
    style.overflow = 'hidden';

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', auClavier);

    return () => {
      style.position = precedent.position;
      style.top = precedent.top;
      style.left = precedent.left;
      style.right = precedent.right;
      style.width = precedent.width;
      style.overflow = precedent.overflow;
      window.scrollTo(0, decalage);
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
          className="fixed inset-0 z-[55]"
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

          {/* La fiche remplit l'écran depuis le haut, comme un vrai écran
              de détail — pas une feuille ancrée en bas. Le contenu
              (image de fond, titre, synopsis, boutons) s'enchaîne donc
              normalement du haut vers le bas, sans espace vide au-dessus. */}
          <motion.div
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative mx-auto h-[100dvh] w-full max-w-xl overflow-y-auto overscroll-contain"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <FicheDetail
              reco={reco}
              plateformesUtilisateur={plateformesUtilisateur}
              dansLaListe={dansLaListe}
              onFermer={onFermer}
              onBandeAnnonce={onBandeAnnonce}
              onSignal={onSignal}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
