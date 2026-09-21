'use client';

/* =====================================================================
   Accueil — l'écran qui répond à « on regarde quoi ce soir ? ».
   ===================================================================== */

import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CarteRecommandation } from '@/components/CarteRecommandation';
import { EtatVide } from '@/components/EtatVide';
import { LecteurBandeAnnonce } from '@/components/LecteurBandeAnnonce';
import { SelecteurHumeur } from '@/components/SelecteurHumeur';
import { SqueletteListe } from '@/components/Squelettes';
import { TirerPourActualiser } from '@/components/TirerPourActualiser';
import { demanderRecommandations } from '@/lib/api-client';
import { useApp } from '@/lib/etat/magasin';
import type { Recommandation, Signal, Titre } from '@/lib/reco/types';

export default function PageAccueil() {
  const {
    profil,
    historique,
    contexte,
    definirHumeur,
    definirCompagnie,
    signaler,
    noterExpositions,
  } = useApp();
  const routeur = useRouter();

  const [recos, setRecos] = useState<Recommandation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [raisonVide, setRaisonVide] = useState<string | null>(null);
  const [titreEnLecture, setTitreEnLecture] = useState<Titre | null>(null);
  const [demo, setDemo] = useState(false);

  // Profil et historique changent à CHAQUE interaction (un pouce levé
  // déplace le vecteur de goûts). On les lit donc via des références :
  // sans cela, chaque clic relancerait une sélection complète et les
  // cartes danseraient sous le doigt.
  const historiqueRef = useRef(historique);
  historiqueRef.current = historique;
  const profilRef = useRef(profil);
  profilRef.current = profil;

  const charger = useCallback(async () => {
    const profilCourant = profilRef.current;
    if (!profilCourant) return;
    setErreur(null);
    try {
      const reponse = await demanderRecommandations({
        profil: profilCourant,
        historique: historiqueRef.current,
        contexte,
        taille: 15,
      });
      setRecos(reponse.recommandations);
      setRaisonVide(reponse.raisonVide);
      setDemo(reponse.modeDemo);
      noterExpositions(reponse.recommandations.map((r) => r.titre));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue.');
      setRecos([]);
    }
    // `noterExpositions` est stable (useCallback sans dépendance).
  }, [contexte, noterExpositions]);

  // On recharge dans trois cas seulement : au premier rendu une fois le
  // profil disponible, quand l'humeur change, et quand la compagnie
  // change. C'est exactement ce qui doit modifier la sélection.
  const profilPret = Boolean(profil);
  useEffect(() => {
    if (!profilPret) return;
    setRecos(null);
    void charger();
  }, [profilPret, contexte.humeur, contexte.compagnie, charger]);

  function auSignal(reco: Recommandation, signal: Signal) {
    signaler(reco.titre, signal);
    // Les refus font disparaître la carte : la liste reste crédible.
    if (signal === 'pas_pour_moi' || signal === 'deja_vu_pas_aime' || signal === 'swipe_passe') {
      setRecos((precedent) => precedent?.filter((r) => r.titre.id !== reco.titre.id) ?? null);
    }
  }

  if (!profil) return <SqueletteListe />;

  const prenom = profil.pseudo || 'toi';

  return (
    <TirerPourActualiser onActualiser={charger}>
      <header className="zone-sure-haut px-5 pb-1 pt-4">
        <p className="text-[13px] tracking-[0.2em] text-or/70">{salutation()}</p>
        <h1 className="mt-1 font-titre text-[2.4rem] leading-none text-ivoire">{prenom}</h1>
      </header>

      <div className="mt-6">
        <SelecteurHumeur
          humeur={contexte.humeur}
          compagnie={contexte.compagnie}
          onHumeur={definirHumeur}
          onCompagnie={definirCompagnie}
        />
      </div>

      <section className="mt-8 px-5" aria-label="Ta sélection">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-titre text-[1.55rem] text-ivoire">Ta sélection</h2>
          {recos && recos.length > 0 && (
            <span className="text-[12px] text-estompe">{recos.length} titres</span>
          )}
        </div>

        {demo && (
          <p className="mb-5 rounded-douce border border-or/25 bg-or/[0.06] px-4 py-3 text-[13px] leading-relaxed text-orClair/90">
            Mode démo : les titres viennent d’un catalogue local. Ajoute une clé TMDB pour
            basculer sur les vraies disponibilités de tes plateformes.
          </p>
        )}

        {recos === null && <SqueletteListe nombre={3} />}

        {erreur && (
          <EtatVide
            titre="Connexion difficile"
            message={erreur}
            actionLibelle="Réessayer"
            onAction={() => void charger()}
          />
        )}

        {!erreur && recos?.length === 0 && (
          <EtatVide
            titre={raisonVide === 'aucune_plateforme' ? 'Aucune plateforme sélectionnée' : 'Rien ne passe les filtres'}
            message={
              raisonVide === 'aucune_plateforme'
                ? 'Choisis au moins un service de streaming pour que CinéMood puisse te proposer quelque chose.'
                : 'Tes critères sont un peu trop serrés pour ce soir. Essaie une autre humeur, ou élargis tes plateformes et ta durée maximale.'
            }
            actionLibelle="Modifier mes plateformes"
            onAction={() => routeur.push('/profil')}
            secondaireLibelle="Enlever l’humeur"
            onSecondaire={() => definirHumeur(null)}
          />
        )}

        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {recos?.map((reco, index) => (
              <CarteRecommandation
                key={reco.titre.id}
                reco={reco}
                priorite={index === 0}
                plateformesUtilisateur={profil.plateformes}
                dansLaListe={historique.liste.includes(reco.titre.id)}
                onBandeAnnonce={() => setTitreEnLecture(reco.titre)}
                onSignal={(signal) => auSignal(reco, signal)}
              />
            ))}
          </AnimatePresence>
        </div>

        {recos && recos.length > 0 && (
          <p className="mt-10 text-center text-[12px] leading-relaxed text-estompe">
            Ce produit utilise l’API TMDB mais n’est pas approuvé ni certifié par TMDB.
          </p>
        )}
      </section>

      <LecteurBandeAnnonce titre={titreEnLecture} onFermer={() => setTitreEnLecture(null)} />
    </TirerPourActualiser>
  );
}

/** Une accroche qui suit l'heure : petit détail, grand effet. */
function salutation(): string {
  const heure = new Date().getHours();
  if (heure < 6) return 'CETTE NUIT';
  if (heure < 12) return 'CE MATIN';
  if (heure < 18) return 'CET APRÈS-MIDI';
  return 'CE SOIR';
}
