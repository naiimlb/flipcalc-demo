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
          // Le fond et le défilement vivent directement sur cet élément
          // `fixed inset-0`, pas sur un enfant dimensionné en `h-[100dvh]`.
          // `100dvh` est censé suivre la barre d'adresse de Safari qui se
          // réduit en pilule pendant le défilement, mais ce suivi est connu
          // pour être défaillant sur `position: fixed` : la hauteur figée
          // du panneau restait alors plus courte que le vrai viewport une
          // fois la barre repliée, laissant un vide en bas où l'accueil
          // (son propre rail, sa propre barre d'onglets) redevenait visible
          // sans aucun voile. `inset: 0` reste toujours exactement calé sur
          // les bords réels du viewport, sans dépendre d'une unité de
          // hauteur calculée à part.
          className="fixed inset-0 z-[55] overflow-y-auto overscroll-contain bg-nuit"
          role="dialog"
          aria-modal="true"
          aria-label={reco.titre.titre}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer la fiche"
            className="absolute inset-0"
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
            className="relative mx-auto w-full max-w-xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
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
