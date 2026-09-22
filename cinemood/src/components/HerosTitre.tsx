'use client';

/* =====================================================================
   HerosTitre.tsx — La proposition du soir, plein cadre.
   ---------------------------------------------------------------------
   L'écran d'accueil s'ouvre sur UN titre, pas sur une liste : c'est la
   promesse de l'app (« arrête de chercher »). L'affiche occupe tout le
   cadre, un dégradé l'enfonce dans le noir pour que le texte reste
   lisible quelle que soit l'image, et une nappe de la couleur de
   l'humeur remonte du bas.
   ===================================================================== */

import { motion } from 'framer-motion';

import { Affiche } from './Affiche';
import { PastillePlateforme } from './PastillePlateforme';
import type { Recommandation, Signal } from '@/lib/reco/types';

interface Props {
  reco: Recommandation;
  plateformesUtilisateur: string[];
  dansLaListe: boolean;
  onBandeAnnonce: () => void;
  onSignal: (signal: Signal) => void;
}

export function HerosTitre({ reco, plateformesUtilisateur, dansLaListe, onBandeAnnonce, onSignal }: Props) {
  const { titre } = reco;
  const plateforme = titre.plateformes.find((p) => plateformesUtilisateur.includes(p)) ?? titre.plateformes[0];

  const format =
    titre.type === 'film'
      ? titre.duree
        ? `${Math.floor(titre.duree / 60)} h ${String(titre.duree % 60).padStart(2, '0')}`
        : 'Film'
      : titre.saisons
        ? `${titre.saisons} saison${titre.saisons > 1 ? 's' : ''}`
        : 'Série';

  return (
    <section
      className="grain relative isolate flex min-h-[74svh] flex-col justify-end overflow-hidden px-5 pb-7"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 74px)' }}
      aria-label="La proposition du soir"
    >
      {/* Respiration très lente façon générique : uniquement `transform`,
          donc l'animation vit sur le compositeur et ne coûte rien au
          défilement. */}
      <div className="absolute inset-0 -z-20 animate-respire">
        <Affiche titre={titre} variante="fond" priorite className="h-full w-full" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgb(6 4 11 / 0.5) 0%, rgb(6 4 11 / 0.08) 26%, rgb(6 4 11 / 0.72) 62%, rgb(6 4 11 / 0.96) 88%, #06040B 100%),' +
            'radial-gradient(95% 58% at 50% 104%, rgb(var(--accent) / 0.95) 0%, rgb(var(--second) / 0.45) 38%, transparent 72%)',
        }}
      />

      <div
        className="absolute inset-x-5 z-10 flex items-center justify-between gap-3"
        style={{ top: 'calc(env(safe-area-inset-top) + 18px)' }}
      >
        {plateforme ? <PastillePlateforme id={plateforme} /> : <span />}
        <div className="flex items-center gap-2">
          {reco.pepite && (
            <span className="rounded-full bg-voile-accent px-3 py-1 text-[11px] font-semibold text-white shadow-accent">
              ✦ Pépite
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-nuit/80 px-3 py-1 text-[12px] font-semibold text-ivoire">
            ★ {titre.note.toFixed(1)}
          </span>
        </div>
      </div>

      <p className="etiquette">La proposition du soir</p>
      <h1
        className="nom-propre lignes-3 mt-2.5 equilibre font-affiche font-bold leading-[1.02] text-ivoire"
        style={{ fontSize: 'clamp(31px, 9vw, 42px)', textShadow: '0 6px 30px rgb(6 4 11 / 0.7)' }}
      >
        {titre.titre}
      </h1>
      <p className="mt-3 text-[13px] uppercase tracking-[0.04em] text-cendre">
        {titre.annee} · {format} · {titre.classification === 'TP' ? 'Tous publics' : `-${titre.classification}`}
      </p>
      <p className="mt-3.5 text-[15px] leading-relaxed text-ivoire/[0.92]">{reco.pourquoi}</p>

      <div className="mt-6 flex items-center gap-2.5">
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={() => {
            onSignal('bande_annonce');
            onBandeAnnonce();
          }}
          className="flex min-h-[50px] flex-1 items-center justify-center gap-2.5 rounded-douce bg-voile-accent text-[15px] font-semibold text-white shadow-accent"
        >
          <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden="true">
            <path d="M8 5.2v13.6L19 12 8 5.2Z" />
          </svg>
          Bande-annonce
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => onSignal(dansLaListe ? 'retrait_liste' : 'ajout_liste')}
          aria-pressed={dansLaListe}
          aria-label={dansLaListe ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
            dansLaListe ? 'border-transparent bg-voile-accent text-white' : 'border-white/10 bg-white/[0.06] text-ivoire'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill={dansLaListe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" />
          </svg>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => onSignal('pas_pour_moi')}
          aria-label="Pas pour moi"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-ivoire"
        >
          <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>
      </div>
    </section>
  );
}
