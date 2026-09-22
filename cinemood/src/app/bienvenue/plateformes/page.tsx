'use client';

/* =====================================================================
   Étape 1, OBLIGATOIRE — « Quelles plateformes as-tu ? »
   ---------------------------------------------------------------------
   Cet écran passe avant tout le reste, y compris le test de goûts :
   recommander un titre que la personne ne peut pas regarder n'a aucune
   valeur. Le choix est modifiable à tout moment dans Profil.
   ===================================================================== */

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState } from 'react';

import { Bouton } from '@/components/Boutons';
import { PastillePlateforme } from '@/components/PastillePlateforme';
import { PLATEFORMES } from '@/lib/reco/plateformes';
import { vecteurVide } from '@/lib/reco/profil';
import { useApp } from '@/lib/etat/magasin';
import type { ProfilUtilisateur } from '@/lib/reco/types';

const PAYS = [
  { code: 'FR', nom: 'France' },
  { code: 'BE', nom: 'Belgique' },
  { code: 'CH', nom: 'Suisse' },
  { code: 'CA', nom: 'Canada' },
  { code: 'LU', nom: 'Luxembourg' },
];

export default function PagePlateformes() {
  const { profil, definirProfil, pret } = useApp();
  const routeur = useRouter();

  const [selection, setSelection] = useState<string[]>(profil?.plateformes ?? []);
  const [sansAbonnement, setSansAbonnement] = useState(false);
  const [pays, setPays] = useState(profil?.pays ?? 'FR');

  const payantes = PLATEFORMES.filter((p) => !p.gratuite);
  const gratuites = PLATEFORMES.filter((p) => p.gratuite);
  const peutContinuer = sansAbonnement || selection.length > 0;

  function basculer(id: string) {
    setSansAbonnement(false);
    setSelection((precedent) =>
      precedent.includes(id) ? precedent.filter((p) => p !== id) : [...precedent, id],
    );
  }

  /**
   * Profil minimal, posé si la personne arrive ici sans avoir encore
   * passé le test. Le test l'écrasera avec de vraies réponses.
   */
  function profilDeDepart(): ProfilUtilisateur {
    return {
      pseudo: '',
      anneeNaissance: new Date().getFullYear() - 30,
      typesSouhaites: ['film', 'serie'],
      genresAdores: [],
      genresDetestes: [],
      tonalitePreferee: 'intense',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: [],
      pays: 'FR',
      gouts: vecteurVide(),
      aEviter: [],
      interets: [],
    };
  }

  function continuer() {
    if (!peutContinuer) return;
    const base = profil ?? profilDeDepart();
    definirProfil(
      { ...base, plateformes: sansAbonnement ? [] : selection, pays },
      { plateformesChoisies: true },
    );
    routeur.push('/bienvenue/test');
  }

  if (!pret) return null;

  return (
    <main className="relative min-h-[100dvh]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-lueur" aria-hidden="true" />

      <div className="relative mx-auto max-w-xl px-6 pb-44">
        <header className="zone-sure-haut pt-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-or/70">Étape 1 sur 2</p>
          <h1 className="equilibre mt-3 font-titre text-[2.5rem] leading-[1.05] text-ivoire">
            Quelles plateformes as-tu ?
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-cendre">
            CinéMood ne te proposera jamais un titre indisponible sur tes services. Tu pourras
            modifier ça quand tu veux.
          </p>
        </header>

        <Section titre="Abonnements">
          <Grille>
            {payantes.map((p) => (
              <Vignette
                key={p.id}
                id={p.id}
                nom={p.nom}
                actif={!sansAbonnement && selection.includes(p.id)}
                onClick={() => basculer(p.id)}
              />
            ))}
          </Grille>
        </Section>

        <Section titre="Gratuit, sans abonnement" sousTitre="Coche-les aussi : il y a de vraies pépites.">
          <Grille>
            {gratuites.map((p) => (
              <Vignette
                key={p.id}
                id={p.id}
                nom={p.nom}
                actif={!sansAbonnement && selection.includes(p.id)}
                onClick={() => basculer(p.id)}
              />
            ))}
          </Grille>
        </Section>

        <button
          type="button"
          onClick={() => {
            setSansAbonnement(!sansAbonnement);
            setSelection([]);
          }}
          aria-pressed={sansAbonnement}
          className={`mt-7 flex min-h-[58px] w-full items-center gap-3 rounded-douce border px-5 text-left transition-colors ${
            sansAbonnement ? 'border-or/60 bg-or/10' : 'border-white/[0.08] bg-white/[0.02]'
          }`}
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
              sansAbonnement ? 'border-or bg-or text-nuit' : 'border-white/20'
            }`}
            aria-hidden="true"
          >
            {sansAbonnement && (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
            )}
          </span>
          <span className={sansAbonnement ? 'text-orClair' : 'text-cendre'}>
            Je n’ai aucun abonnement
            <span className="mt-0.5 block text-[13px] text-estompe">
              Recommandations sur les offres gratuites uniquement
            </span>
          </span>
        </button>

        <Section titre="Mon pays" sousTitre="Il détermine les disponibilités et les classifications d’âge.">
          <div className="flex flex-wrap gap-2">
            {PAYS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setPays(p.code)}
                aria-pressed={pays === p.code}
                className={`min-h-[44px] rounded-full border px-4 text-[15px] transition-colors ${
                  pays === p.code ? 'border-or/60 bg-or/12 text-orClair' : 'border-white/10 text-cendre'
                }`}
              >
                {p.nom}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* Barre d'action fixe : le bouton reste toujours sous le pouce. */}
      <div
        className="verre-fort fixed inset-x-0 bottom-0 border-t border-white/[0.07] px-6 pt-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="mx-auto max-w-xl">
          <motion.div animate={{ opacity: peutContinuer ? 1 : 0.45 }}>
            <Bouton variante="or" pleineLargeur onClick={continuer} disabled={!peutContinuer}>
              Continuer
            </Bouton>
          </motion.div>
          <p className="mt-2.5 text-center text-[12px] text-estompe">
            {peutContinuer
              ? sansAbonnement
                ? 'Offres gratuites uniquement'
                : `${selection.length} plateforme${selection.length > 1 ? 's' : ''} sélectionnée${selection.length > 1 ? 's' : ''}`
              : 'Sélectionne au moins une plateforme'}
          </p>
        </div>
      </div>
    </main>
  );
}

function Section({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[13px] uppercase tracking-[0.16em] text-estompe">{titre}</h2>
      {sousTitre && <p className="mt-1 text-[13px] text-estompe/80">{sousTitre}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Grille({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}

function Vignette({ id, nom, actif, onClick }: { id: string; nom: string; actif: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={actif}
      className={`flex min-h-[88px] flex-col items-center justify-center gap-2.5 rounded-carte border px-2 transition-colors ${
        actif ? 'border-or/60 bg-or/10' : 'border-white/[0.07] bg-white/[0.025]'
      }`}
    >
      <PastillePlateforme id={id} taille="grande" />
      <span className={`text-center text-[11.5px] leading-tight ${actif ? 'text-orClair' : 'text-estompe'}`}>
        {nom}
      </span>
    </motion.button>
  );
}
