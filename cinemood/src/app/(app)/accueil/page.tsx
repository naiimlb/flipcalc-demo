'use client';

/* =====================================================================
   Accueil — un héros, puis des carrousels.
   ---------------------------------------------------------------------
   Tous les carrousels dérivent d'UNE seule passe du moteur : ils
   respectent donc exactement les mêmes règles dures (plateformes de la
   personne, classification d'âge, refus définitifs). Aucun rail n'est
   une liste décorative remplie à part.
   ===================================================================== */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EtatVide } from '@/components/EtatVide';
import { FicheTitre } from '@/components/FicheTitre';
import { HerosTitre } from '@/components/HerosTitre';
import { LecteurBandeAnnonce } from '@/components/LecteurBandeAnnonce';
import { RailTitres } from '@/components/RailTitres';
import { SqueletteAccueil } from '@/components/Squelettes';
import { TirerPourActualiser } from '@/components/TirerPourActualiser';
import { demanderRecommandations } from '@/lib/api-client';
import { useApp } from '@/lib/etat/magasin';
import { similariteTitres } from '@/lib/reco/diversite';
import { TABLE_HUMEURS } from '@/lib/reco/poids';
import { IDENTITE_HUMEUR } from '@/lib/ui/humeurs';
import type { Recommandation, Signal, Titre } from '@/lib/reco/types';

const ANNEE = new Date().getFullYear();

export default function PageAccueil() {
  const { profil, historique, titresConnus, contexte, definirHumeur, signaler, noterExpositions } = useApp();
  const routeur = useRouter();

  const [recos, setRecos] = useState<Recommandation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [raisonVide, setRaisonVide] = useState<string | null>(null);
  const [titreEnLecture, setTitreEnLecture] = useState<Titre | null>(null);
  const [fiche, setFiche] = useState<Recommandation | null>(null);
  const [demo, setDemo] = useState(false);
  const [humeurRelachee, setHumeurRelachee] = useState(false);

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
        taille: 30,
      });
      setRecos(reponse.recommandations);
      setRaisonVide(reponse.raisonVide);
      setDemo(reponse.modeDemo);
      setHumeurRelachee(reponse.humeurRelachee);
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

  /* --- Les trois rails, dérivés de la même passe ---------------------- */
  const rails = useMemo(() => {
    if (!recos || recos.length === 0) return null;
    const suite = recos.slice(1);

    // « Parce que tu as aimé … » n'existe que s'il y a vraiment de quoi :
    // un titre aimé, et des propositions qui lui ressemblent réellement.
    const aimes = Object.values(titresConnus).filter(
      (t) => historique.vus[t.id] === 1 || historique.liste.includes(t.id),
    );
    const reference = aimes.length ? aimes[aimes.length - 1] : null;
    const similaires = reference
      ? suite
          .filter((r) => r.titre.id !== reference.id)
          .map((r) => ({ reco: r, proximite: similariteTitres(reference, r.titre) }))
          .filter((x) => x.proximite > 0.12)
          .sort((a, b) => b.proximite - a.proximite)
          .slice(0, 10)
          .map((x) => x.reco)
      : [];

    const nouveautes = suite
      .filter((r) => r.titre.annee >= ANNEE - 2)
      .sort((a, b) => b.titre.annee - a.titre.annee)
      .slice(0, 10);

    return { pourToi: suite.slice(0, 10), reference, similaires, nouveautes };
  }, [recos, titresConnus, historique]);

  function auSignal(reco: Recommandation, signal: Signal) {
    signaler(reco.titre, signal);
    // Les refus font disparaître le titre : la sélection reste crédible.
    if (signal === 'pas_pour_moi' || signal === 'deja_vu_pas_aime' || signal === 'swipe_passe') {
      setRecos((precedent) => precedent?.filter((r) => r.titre.id !== reco.titre.id) ?? null);
    }
    setFiche(null);
  }

  if (!profil) return <SqueletteAccueil />;

  const reglageHumeur = contexte.humeur ? TABLE_HUMEURS[contexte.humeur] : null;
  const identiteHumeur = contexte.humeur ? IDENTITE_HUMEUR[contexte.humeur] : null;

  return (
    <TirerPourActualiser onActualiser={charger}>
      {recos === null && <SqueletteAccueil />}

      {recos && recos.length > 0 && (
        <HerosTitre
          reco={recos[0]}
          plateformesUtilisateur={profil.plateformes}
          dansLaListe={historique.liste.includes(recos[0].titre.id)}
          onBandeAnnonce={() => setTitreEnLecture(recos[0].titre)}
          onSignal={(signal) => auSignal(recos[0], signal)}
        />
      )}

      {recos !== null && (
        <div className="mt-4 flex items-center justify-between gap-3.5 px-5">
          <div>
            <p className="etiquette">{salutation()}</p>
            <p className="mt-1 font-affiche text-[30px] font-bold uppercase leading-none text-ivoire">
              {profil.pseudo || 'toi'}
            </p>
          </div>

          <Link
            href="/humeur"
            className="flex min-h-[46px] items-center gap-2.5 rounded-full border border-accent/60 bg-gradient-to-r from-accent/30 to-second/[0.16] pl-4 pr-2 text-[14.5px] font-medium text-ivoire"
          >
            {identiteHumeur ? (
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={identiteHumeur.icone} />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2" />
              </svg>
            )}
            <span className="whitespace-nowrap">{reglageHumeur ? reglageHumeur.libelle : 'Choisir une humeur'}</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M9.5 5 16 12l-6.5 7" />
            </svg>
          </Link>
        </div>
      )}

      {demo && (
        <p className="mx-5 mt-6 rounded-douce border border-accent/25 bg-accent/[0.08] px-4 py-3 text-[13px] leading-relaxed text-ivoire/90">
          Mode démo : les titres viennent d’un catalogue local. Ajoute une clé TMDB pour
          basculer sur les vraies disponibilités de tes plateformes.
        </p>
      )}

      {/* La sélection ne correspond pas à l'humeur demandée : le dire,
          plutôt que de laisser croire que le moteur l'a ignorée. */}
      {humeurRelachee && reglageHumeur && (
        <p className="mx-5 mt-6 rounded-douce border border-accent/25 bg-accent/[0.08] px-4 py-3 text-[13px] leading-relaxed text-ivoire/90">
          Rien ne collait vraiment à « {reglageHumeur.libelle} » sur tes plateformes ce soir.
          Voici une sélection élargie, qui respecte tous tes autres critères.
        </p>
      )}

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

      {rails && (
        <>
          <RailTitres
            titre="Pour toi ce soir"
            sousTitre={`${recos?.length ?? 0} titres passent tes filtres`}
            recos={rails.pourToi}
            onChoisir={setFiche}
          />

          {rails.similaires.length >= 3 && rails.reference && (
            <RailTitres
              titre={`Parce que tu as aimé ${rails.reference.titre}`}
              sousTitre="Même veine, autre soirée"
              recos={rails.similaires}
              onChoisir={setFiche}
            />
          )}

          {rails.nouveautes.length >= 3 && (
            <RailTitres
              titre="Nouveautés sur tes plateformes"
              sousTitre={`Sorties depuis ${ANNEE - 2}`}
              recos={rails.nouveautes}
              onChoisir={setFiche}
            />
          )}
        </>
      )}

      {/* Attribution TMDB : exigée par leurs conditions d'utilisation, donc
          affichée quel que soit l'état de l'écran — y compris quand la
          sélection est vide ou en erreur. */}
      <p className="mt-12 px-8 text-center text-[12px] leading-relaxed text-estompe">
        Ce produit utilise l’API TMDB mais n’est pas approuvé ni certifié par TMDB.
      </p>

      <FicheTitre
        reco={fiche}
        plateformesUtilisateur={profil.plateformes}
        dansLaListe={fiche ? historique.liste.includes(fiche.titre.id) : false}
        onFermer={() => setFiche(null)}
        onBandeAnnonce={() => {
          if (fiche) setTitreEnLecture(fiche.titre);
          setFiche(null);
        }}
        onSignal={(signal) => fiche && auSignal(fiche, signal)}
      />

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
