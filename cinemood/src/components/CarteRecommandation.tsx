'use client';

/* =====================================================================
   CarteRecommandation.tsx — La carte, cœur de l'écran d'accueil.
   ---------------------------------------------------------------------
   Elle porte tout ce que le cahier des charges demande : affiche en
   grand, titre, année, durée ou saisons, note, genres, plateforme,
   « Pourquoi pour toi », bouton bande-annonce très visible, et les
   quatre actions.

   Elle est aussi glissable : vers la droite pour garder, vers la gauche
   pour passer. Le geste est facultatif — tout reste faisable au doigt
   sur les boutons, pour qui ne devine pas le swipe.
   ===================================================================== */

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Affiche } from './Affiche';
import { BoutonRond } from './Boutons';
import { PastillePlateforme } from './PastillePlateforme';
import { PLATEFORME_PAR_ID } from '@/lib/reco/plateformes';
import type { Recommandation, Signal } from '@/lib/reco/types';

interface Props {
  reco: Recommandation;
  /** Plateformes de la personne : sert à choisir le bon lien « Ouvrir sur ». */
  plateformesUtilisateur: string[];
  dansLaListe: boolean;
  priorite?: boolean;
  onBandeAnnonce: () => void;
  onSignal: (signal: Signal) => void;
}

/** Distance de glissement à partir de laquelle le geste est validé. */
const SEUIL_SWIPE = 110;

export function CarteRecommandation({
  reco,
  plateformesUtilisateur,
  dansLaListe,
  priorite = false,
  onBandeAnnonce,
  onSignal,
}: Props) {
  const { titre } = reco;

  const x = useMotionValue(0);
  const rotation = useTransform(x, [-220, 220], [-7, 7]);
  const voileGarde = useTransform(x, [30, SEUIL_SWIPE], [0, 1]);
  const voilePasse = useTransform(x, [-SEUIL_SWIPE, -30], [1, 0]);

  const plateformePrincipale =
    titre.plateformes.find((p) => plateformesUtilisateur.includes(p)) ?? titre.plateformes[0];
  const lien = plateformePrincipale ? PLATEFORME_PAR_ID[plateformePrincipale]?.lien : undefined;

  const format =
    titre.type === 'film'
      ? titre.duree
        ? `${Math.floor(titre.duree / 60)} h ${String(titre.duree % 60).padStart(2, '0')}`
        : 'Film'
      : titre.saisons
        ? `${titre.saisons} saison${titre.saisons > 1 ? 's' : ''}`
        : 'Série';

  function terminerGlissement(deplacement: number, vitesse: number) {
    const franchi = Math.abs(deplacement) > SEUIL_SWIPE || Math.abs(vitesse) > 620;
    if (!franchi) return;
    // C'est la liste parente qui décide de retirer la carte : elle le
    // fait pour « je passe », et la garde en place pour « je garde »
    // (le titre rejoint alors « Ma liste », le marque-page se remplit).
    onSignal(deplacement > 0 ? 'swipe_garde' : 'swipe_passe');
  }

  return (
    <motion.article
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.28}
      style={{ x, rotate: rotation }}
      onDragEnd={(_, info) => terminerGlissement(info.offset.x, info.velocity.x)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="insaisissable relative overflow-hidden rounded-carte verre shadow-carte"
    >
      {/* Voiles de retour visuel pendant le glissement. */}
      <motion.div
        style={{ opacity: voileGarde }}
        className="pointer-events-none absolute inset-0 z-20 flex items-start justify-start bg-succes/15 p-5"
      >
        <span className="rounded-full border border-succes/60 px-4 py-1.5 text-sm font-semibold text-succes">
          Je garde
        </span>
      </motion.div>
      <motion.div
        style={{ opacity: voilePasse }}
        className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end bg-alerte/15 p-5"
      >
        <span className="rounded-full border border-alerte/60 px-4 py-1.5 text-sm font-semibold text-alerte">
          Je passe
        </span>
      </motion.div>

      {/* --- Affiche et informations principales ------------------------ */}
      <div className="relative">
        <Affiche titre={titre} variante="couverture" priorite={priorite} className="aspect-[2/3] w-full" />
        <div className="pointer-events-none absolute inset-0 bg-voile-nuit" />

        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          {plateformePrincipale && <PastillePlateforme id={plateformePrincipale} />}
          <div className="flex flex-col items-end gap-2">
            {reco.pepite && (
              <span className="rounded-full border border-accent/50 bg-nuit/70 px-3 py-1 text-[11px] font-medium tracking-wide text-ivoire backdrop-blur">
                ✦ Pépite
              </span>
            )}
            <span className="rounded-full bg-nuit/70 px-3 py-1 text-[12px] font-semibold text-ivoire backdrop-blur">
              {titre.note.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="equilibre font-affiche text-[2rem] leading-[1.06] text-ivoire">
            {titre.titre}
          </h2>
          <p className="mt-2 text-[13px] text-cendre">
            {titre.annee} · {format} · {titre.classification === 'TP' ? 'Tous publics' : `-${titre.classification}`}
          </p>
          <p className="mt-1 text-[13px] text-estompe">{titre.genres.slice(0, 3).join(' · ')}</p>
        </div>
      </div>

      {/* --- Pourquoi pour toi ----------------------------------------- */}
      <div className="border-t border-white/[0.06] px-5 py-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accentTexte">
          Pourquoi pour toi
        </p>
        <p className="text-[15px] leading-relaxed text-ivoire/85">{reco.pourquoi}</p>
      </div>

      {/* --- Bande-annonce : l'action la plus visible -------------------- */}
      <div className="px-5 pb-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => {
            onSignal('bande_annonce');
            onBandeAnnonce();
          }}
          className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-douce bg-voile-accent text-[16px] font-semibold text-white shadow-accent"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M8 5.2v13.6L19 12 8 5.2Z" />
          </svg>
          Bande-annonce
        </motion.button>
      </div>

      {/* --- Actions ---------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3.5">
        <BoutonRond
          libelle={dansLaListe ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
          actif={dansLaListe}
          onClick={() => onSignal(dansLaListe ? 'retrait_liste' : 'ajout_liste')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill={dansLaListe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" />
          </svg>
        </BoutonRond>

        <BoutonRond libelle="Déjà vu, j’ai aimé" onClick={() => onSignal('deja_vu_aime')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M7 10.5V20H4V10.5h3Zm3 0 3.2-6.6a1.8 1.8 0 0 1 3.4 1.1L16 9h3.6a1.8 1.8 0 0 1 1.75 2.25l-1.7 6.6A2.4 2.4 0 0 1 17.3 20H10V10.5Z" />
          </svg>
        </BoutonRond>

        <BoutonRond libelle="Déjà vu, je n’ai pas aimé" onClick={() => onSignal('deja_vu_pas_aime')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-180" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M7 10.5V20H4V10.5h3Zm3 0 3.2-6.6a1.8 1.8 0 0 1 3.4 1.1L16 9h3.6a1.8 1.8 0 0 1 1.75 2.25l-1.7 6.6A2.4 2.4 0 0 1 17.3 20H10V10.5Z" />
          </svg>
        </BoutonRond>

        <BoutonRond libelle="Pas pour moi" onClick={() => onSignal('pas_pour_moi')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </BoutonRond>

        {lien && (
          <a
            href={lien}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onSignal('ouverture_fiche')}
            className="flex h-[46px] items-center gap-1.5 rounded-full verre px-4 text-[13px] font-medium text-ivoire"
          >
            Ouvrir
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M8 16 16 8M9.5 8H16v6.5" />
            </svg>
          </a>
        )}
      </div>
    </motion.article>
  );
}
