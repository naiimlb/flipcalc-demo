'use client';

/* =====================================================================
   FicheDetail.tsx — Le contenu de la fiche film/série, en grand.
   ---------------------------------------------------------------------
   Une vraie page de détail, pas une carte compacte : image de fond en
   tête, affiche et titre superposés à cheval sur les deux, informations
   organisées en colonnes, puis synopsis et actions. `CarteRecommandation`
   reste inutilisée ici — elle est pensée pour un geste de swipe qui n'a
   pas sa place dans un écran qu'on vient lire en détail.
   ===================================================================== */

import { motion } from 'framer-motion';

import { Affiche } from './Affiche';
import { BoutonRond } from './Boutons';
import { PastillePlateforme } from './PastillePlateforme';
import { PLATEFORME_PAR_ID } from '@/lib/reco/plateformes';
import type { Recommandation, Signal } from '@/lib/reco/types';

interface Props {
  reco: Recommandation;
  plateformesUtilisateur: string[];
  dansLaListe: boolean;
  onFermer: () => void;
  onBandeAnnonce: () => void;
  onSignal: (signal: Signal) => void;
}

export function FicheDetail({
  reco,
  plateformesUtilisateur,
  dansLaListe,
  onFermer,
  onBandeAnnonce,
  onSignal,
}: Props) {
  const { titre } = reco;

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

  return (
    <article className="overflow-hidden verre">
      {/* --- Image de fond, plein cadre ---------------------------------- */}
      <div className="relative aspect-[16/10] w-full">
        <Affiche titre={titre} variante="fond" priorite className="h-full w-full" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgb(6 4 11 / 0.55) 0%, rgb(6 4 11 / 0.05) 30%, rgb(6 4 11 / 0.15) 62%, rgb(10 8 16 / 0.96) 100%)',
          }}
        />

        {/* Retour : la seule commande de fermeture de l'écran. La fiche
            remplit maintenant l'écran depuis le haut réel de l'appareil,
            donc ce bouton doit être décalé sous l'encoche / la Dynamic
            Island plutôt que collé au bord. */}
        <button
          type="button"
          onClick={onFermer}
          aria-label="Retour"
          className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-nuit/80 text-ivoire"
          style={{ top: 'max(env(safe-area-inset-top), 16px)' }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>

        <span
          className="absolute right-4 z-10 rounded-full border border-white/10 bg-nuit/80 px-3 py-1 text-[12px] font-semibold text-ivoire"
          style={{ top: 'calc(max(env(safe-area-inset-top), 16px) + 2px)' }}
        >
          ★ {titre.note.toFixed(1)}
        </span>
      </div>

      {/* --- Affiche et titre, à cheval sur l'image de fond -------------- */}
      <div className="relative px-5">
        <div className="-mt-14 flex items-end gap-3.5">
          <Affiche
            titre={titre}
            variante="vignette"
            className="h-[126px] w-[84px] shrink-0 rounded-douce shadow-flottant ring-1 ring-white/10"
          />
          <div className="min-w-0 pb-1">
            {reco.pepite && (
              <span className="mb-1.5 inline-block rounded-full bg-voile-accent px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white shadow-accent">
                ✦ Pépite
              </span>
            )}
            <h1 className="nom-propre lignes-3 equilibre font-affiche text-[1.7rem] font-bold leading-[1.06] text-ivoire">
              {titre.titre}
            </h1>
          </div>
        </div>

        {plateformePrincipale && (
          <div className="mt-4">
            <PastillePlateforme id={plateformePrincipale} taille="grande" avecNom />
          </div>
        )}

        {/* --- Informations en colonnes ----------------------------------- */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-douce border border-white/10 bg-white/[0.03] py-3.5">
          <Colonne libelle="Année" valeur={String(titre.annee)} />
          <Colonne libelle={titre.type === 'film' ? 'Durée' : 'Format'} valeur={format} />
          <Colonne
            libelle="Classification"
            valeur={titre.classification === 'TP' ? 'Tous publics' : `-${titre.classification}`}
          />
        </div>

        {titre.genres.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {titre.genres.slice(0, 5).map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12.5px] text-cendre"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* --- Synopsis ---------------------------------------------------- */}
        {titre.synopsis && (
          <div className="mt-5">
            <p className="etiquette mb-1.5">Synopsis</p>
            <p className="text-[15px] leading-relaxed text-ivoire/85">{titre.synopsis}</p>
          </div>
        )}

        {/* --- Pourquoi pour toi -------------------------------------------- */}
        <div className="mt-5 rounded-douce border border-accent/20 bg-accent/[0.06] px-4 py-3.5">
          <p className="etiquette mb-1.5">Pourquoi pour toi</p>
          <p className="text-[14.5px] leading-relaxed text-ivoire/85">{reco.pourquoi}</p>
        </div>

        {/* --- Bande-annonce et liste ---------------------------------------- */}
        <div className="mt-5 flex items-center gap-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              onSignal('bande_annonce');
              onBandeAnnonce();
            }}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-douce bg-voile-accent text-[16px] font-semibold text-white shadow-accent"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M8 5.2v13.6L19 12 8 5.2Z" />
            </svg>
            Bande-annonce
          </motion.button>

          <BoutonRond
            libelle={dansLaListe ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
            actif={dansLaListe}
            className="shrink-0"
            onClick={() => onSignal(dansLaListe ? 'retrait_liste' : 'ajout_liste')}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill={dansLaListe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
              <path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" />
            </svg>
          </BoutonRond>
        </div>

        {/* --- Retours d'apprentissage --------------------------------------- */}
        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pb-5 pt-3.5">
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
      </div>
    </article>
  );
}

function Colonne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex flex-col items-center px-2 text-center">
      <span className="text-[15px] font-semibold text-ivoire">{valeur}</span>
      <span className="mt-0.5 text-[10.5px] uppercase tracking-[0.06em] text-estompe">{libelle}</span>
    </div>
  );
}
