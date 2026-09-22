'use client';

/* =====================================================================
   LecteurBandeAnnonce.tsx — Lecteur plein écran, un seul appui.
   ---------------------------------------------------------------------
   Exigence du cahier des charges : un clic → plein écran en autoplay,
   fermeture simple. Détails qui comptent sur iPhone :
     • `playsinline` évite que Safari sorte de l'app pour lire la vidéo ;
     • le défilement du fond est bloqué pendant la lecture ;
     • Échap et un large bouton « Fermer » sortent du lecteur ;
     • sans identifiant vidéo (mode démo), on bascule proprement vers une
       recherche YouTube plutôt que d'afficher un lecteur vide.
   ===================================================================== */

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import type { Titre } from '@/lib/reco/types';

interface Props {
  titre: Titre | null;
  onFermer: () => void;
}

export function LecteurBandeAnnonce({ titre, onFermer }: Props) {
  const [cle, setCle] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  // Récupère la clé YouTube si le titre ne la porte pas déjà.
  useEffect(() => {
    if (!titre) {
      setCle(null);
      return;
    }
    if (titre.bandeAnnonce) {
      setCle(titre.bandeAnnonce);
      return;
    }

    let actif = true;
    setChargement(true);
    fetch(`/api/bande-annonce/${titre.type}/${titre.tmdbId}`)
      .then((r) => r.json())
      .then((data: { cle: string | null }) => {
        if (actif) setCle(data.cle);
      })
      .catch(() => {
        if (actif) setCle(null);
      })
      .finally(() => {
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [titre]);

  // Bloque le défilement de la page pendant la lecture.
  useEffect(() => {
    if (!titre) return;
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
  }, [titre, onFermer]);

  return (
    <AnimatePresence>
      {titre && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={`Bande-annonce de ${titre.titre}`}
        >
          <div
            className="flex items-center justify-between px-4 pb-2"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
          >
            <p className="truncate pr-4 font-affiche text-lg text-ivoire">{titre.titre}</p>
            <button
              type="button"
              onClick={onFermer}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-ivoire"
              aria-label="Fermer la bande-annonce"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-1">
            {chargement && (
              <div className="squelette aspect-video w-full max-w-3xl" aria-label="Chargement de la bande-annonce" />
            )}

            {!chargement && cle && (
              <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-douce bg-black">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${cle}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                  title={`Bande-annonce de ${titre.titre}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}

            {!chargement && !cle && (
              <div className="px-8 text-center">
                <p className="font-affiche text-2xl text-ivoire">Bande-annonce indisponible ici</p>
                <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-cendre">
                  En mode démo, CinéMood ne connaît pas encore les vidéos TMDB. Tu peux l’ouvrir
                  directement sur YouTube.
                </p>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    `${titre.titre} ${titre.annee} bande-annonce`,
                  )}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-6 inline-flex min-h-[48px] items-center rounded-douce bg-voile-accent px-6 font-semibold text-white"
                >
                  Chercher sur YouTube
                </a>
              </div>
            )}
          </div>

          <div style={{ height: 'max(env(safe-area-inset-bottom), 16px)' }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
