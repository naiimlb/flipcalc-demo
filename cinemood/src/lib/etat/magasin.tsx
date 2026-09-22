'use client';

/* =====================================================================
   magasin.tsx — L'état de l'application, partagé par tous les écrans.
   ---------------------------------------------------------------------
   Deux modes, une seule règle : QUAND UN COMPTE EST CONNECTÉ, LA BASE DE
   DONNÉES EST LA SEULE SOURCE DE VÉRITÉ.

     • Invité (pas de compte, ou Supabase non configuré) : l'appareil est
       la source de vérité (localStorage). L'app reste utilisable sans
       compte et sans réseau, comme avant.
     • Connecté : à chaque connexion, l'état est entièrement rechargé
       depuis Supabase — jamais depuis localStorage, qui n'est ni lu ni
       écrit dans ce mode. Chaque écriture significative (profil, signal,
       exposition, humeur) est poussée vers la base ; les échecs sont
       signalés, jamais avalés en silence.

   Ce fichier ne contient aucune logique de requête : tout ce qui parle à
   Supabase est dans `src/lib/cloud/compte.ts`, pur et testable. Ici, on
   ne fait que brancher ces fonctions sur le cycle de vie de React.
   ===================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  appliquerSignal,
  enregistrerExpositions as enregistrerExpositionsLocal,
  enregistrerSignal as enregistrerSignalLocal,
  historiqueVide,
} from '@/lib/reco/profil';
import { contexteParDefaut } from '@/lib/reco/humeur';
import {
  ErreurChargementCompte,
  chargerEtatCompte,
  enregistrerExpositionsCloud,
  enregistrerHumeurCloud,
  enregistrerProfilCloud,
  enregistrerSignalCloud,
} from '@/lib/cloud/compte';
import type { ResultatEcriture } from '@/lib/cloud/compte';
import { clientNavigateur } from '@/lib/supabase/navigateur';
import { SUPABASE_CONFIGURE } from '@/lib/supabase/config';
import type { Compagnie, Contexte, Historique, Humeur, ProfilUtilisateur, Signal, Titre } from '@/lib/reco/types';

const CLE_STOCKAGE = 'cinemood.etat.v1';

export interface EtatApp {
  profil: ProfilUtilisateur | null;
  historique: Historique;
  /** Titres mis en cache pour « Ma liste » et les références citées. */
  titresConnus: Record<string, Titre>;
  /** Le test de personnalité a-t-il été terminé ? */
  testTermine: boolean;
  /** Les plateformes ont-elles été choisies ? (étape obligatoire) */
  plateformesChoisies: boolean;
}

/** Ce que renvoient les actions qui écrivent quelque chose d'important :
 *  jamais un simple `void`, pour que l'écran appelant puisse réagir à un
 *  échec plutôt que de prétendre que tout s'est bien passé. */
export type ResultatAction = ResultatEcriture;

interface ValeurContexte extends EtatApp {
  /** `false` tant que l'état (local ou distant) n'a pas fini de se charger. */
  pret: boolean;
  contexte: Contexte;
  /** `true` si un compte Supabase est connecté. */
  connecte: boolean;
  /** L'adresse e-mail du compte connecté, pour l'afficher dans Profil. */
  emailCompte: string | null;
  /**
   * Renseigné quand le CHARGEMENT depuis le compte a échoué (réseau
   * coupé, projet mal configuré). Tant que ce message est présent, l'état
   * affiché n'est PAS fiable : l'écran doit proposer de réessayer plutôt
   * que de laisser croire que le compte est vide.
   */
  erreurCompte: string | null;
  /** Renseigné brièvement après l'échec d'une écriture (signal, humeur…). */
  erreurEcriture: string | null;
  definirProfil: (
    profil: ProfilUtilisateur,
    options?: { testTermine?: boolean; plateformesChoisies?: boolean },
  ) => Promise<ResultatAction>;
  majProfil: (modification: Partial<ProfilUtilisateur>) => Promise<ResultatAction>;
  signaler: (titre: Titre, signal: Signal) => void;
  noterExpositions: (titres: Titre[]) => void;
  definirHumeur: (humeur: Humeur | null) => void;
  definirCompagnie: (compagnie: Compagnie) => void;
  reinitialiser: () => void;
  /** Relance le chargement depuis le compte, après un échec. */
  reessayerChargement: () => void;
  effacerErreurEcriture: () => void;
}

const ContexteApp = createContext<ValeurContexte | null>(null);

const ETAT_INITIAL: EtatApp = {
  profil: null,
  historique: historiqueVide(),
  titresConnus: {},
  testTermine: false,
  plateformesChoisies: false,
};

/** Le message montré quand une écriture individuelle échoue (non bloquant). */
const DUREE_AFFICHAGE_ERREUR_ECRITURE_MS = 7000;

export function FournisseurApp({ children }: { children: React.ReactNode }) {
  const [etat, setEtat] = useState<EtatApp>(ETAT_INITIAL);
  const [pret, setPret] = useState(false);
  const [connecte, setConnecte] = useState(false);
  const [emailCompte, setEmailCompte] = useState<string | null>(null);
  const [erreurCompte, setErreurCompte] = useState<string | null>(null);
  const [erreurEcriture, setErreurEcriture] = useState<string | null>(null);
  const [contexte, setContexte] = useState<Contexte>(() => contexteParDefaut());

  // Références stables : lues depuis des callbacks qui ne doivent pas se
  // reconstruire à chaque changement d'état (sinon les `useCallback` qui
  // les utilisent perdraient leur intérêt et les effets se relanceraient
  // en boucle).
  const etatRef = useRef(etat);
  etatRef.current = etat;
  const utilisateurIdRef = useRef<string | null>(null);
  const premierRendu = useRef(true);
  const minuterieErreur = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- Mode invité : lecture/écriture sur l'appareil ------------------ */
  const chargerDepuisLocalStorage = useCallback(() => {
    try {
      const brut = window.localStorage.getItem(CLE_STOCKAGE);
      if (brut) {
        const charge = JSON.parse(brut) as Partial<EtatApp>;
        setEtat({
          profil: charge.profil ?? null,
          historique: { ...historiqueVide(), ...(charge.historique ?? {}) },
          titresConnus: charge.titresConnus ?? {},
          testTermine: Boolean(charge.testTermine),
          plateformesChoisies: Boolean(charge.plateformesChoisies),
        });
        return;
      }
    } catch {
      // Navigation privée, quota plein, données corrompues : on repart
      // d'un état vierge plutôt que de bloquer l'app.
    }
    setEtat(ETAT_INITIAL);
  }, []);

  /* --- Chargement depuis le compte (source de vérité si connecté) ---- */
  const chargerDepuisLeCompte = useCallback(async (utilisateurId: string) => {
    const supabase = clientNavigateur();
    if (!supabase) return;
    utilisateurIdRef.current = utilisateurId;
    try {
      const charge = await chargerEtatCompte(supabase, utilisateurId);
      setEtat({
        profil: charge.profil,
        historique: charge.historique,
        titresConnus: charge.titresConnus,
        testTermine: charge.testTermine,
        plateformesChoisies: charge.plateformesChoisies,
      });
      setErreurCompte(null);
    } catch (erreur) {
      console.error('[magasin] chargement du compte', erreur);
      setErreurCompte(
        erreur instanceof ErreurChargementCompte
          ? 'Impossible de charger tes données. Vérifie ta connexion et réessaie.'
          : 'Une erreur inattendue est survenue pendant le chargement de ton compte.',
      );
      // On ne remplace PAS l'état par du vide : mieux vaut garder ce qui
      // était affiché (ou rien, au tout premier chargement) que de faire
      // croire à un compte vierge alors que ses données existent bel et
      // bien côté serveur.
    } finally {
      setPret(true);
    }
  }, []);

  /* --- Cycle de vie de l'authentification ----------------------------- */
  useEffect(() => {
    let actif = true;

    if (!SUPABASE_CONFIGURE) {
      chargerDepuisLocalStorage();
      setPret(true);
      return;
    }
    const supabase = clientNavigateur();
    if (!supabase) {
      chargerDepuisLocalStorage();
      setPret(true);
      return;
    }

    // `onAuthStateChange` émet un premier événement (`INITIAL_SESSION`)
    // dès l'abonnement, avec l'état de session déjà connu : c'est ce qui
    // sert d'amorçage, sans avoir besoin d'un second appel séparé qui
    // risquerait de déclencher un double chargement.
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, session) => {
      if (!actif) return;

      if (session?.user) {
        setConnecte(true);
        setEmailCompte(session.user.email ?? null);
        if (utilisateurIdRef.current !== session.user.id) {
          void chargerDepuisLeCompte(session.user.id);
        } else {
          setPret(true);
        }
      } else {
        utilisateurIdRef.current = null;
        setConnecte(false);
        setEmailCompte(null);
        setErreurCompte(null);
        chargerDepuisLocalStorage();
        setPret(true);
      }
    });

    return () => {
      actif = false;
      abonnement.subscription.unsubscribe();
    };
    // Ces deux callbacks sont stables (`useCallback` sans dépendance
    // variable) : les inclure ne relance pas l'effet à chaque rendu.
  }, [chargerDepuisLocalStorage, chargerDepuisLeCompte]);

  /* --- Sauvegarde sur l'appareil, UNIQUEMENT en mode invité ----------- */
  useEffect(() => {
    if (!pret || connecte) return;
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
    } catch {
      // Quota dépassé : l'app continue, seule la persistance est perdue.
    }
  }, [etat, pret, connecte]);

  /* --- Petit signal d'erreur d'écriture, auto-effacé -------------------- */
  const signalerErreurEcriture = useCallback((message: string) => {
    setErreurEcriture(message);
    if (minuterieErreur.current) clearTimeout(minuterieErreur.current);
    minuterieErreur.current = setTimeout(() => setErreurEcriture(null), DUREE_AFFICHAGE_ERREUR_ECRITURE_MS);
  }, []);

  useEffect(() => () => {
    if (minuterieErreur.current) clearTimeout(minuterieErreur.current);
  }, []);

  /* --- Actions ---------------------------------------------------------- */

  const definirProfil = useCallback<ValeurContexte['definirProfil']>(
    async (profil, options) => {
      const suivant: EtatApp = {
        ...etatRef.current,
        profil,
        testTermine: options?.testTermine ?? etatRef.current.testTermine,
        plateformesChoisies: options?.plateformesChoisies ?? etatRef.current.plateformesChoisies,
      };
      setEtat(suivant);

      if (!connecte || !utilisateurIdRef.current) return { ok: true };

      const supabase = clientNavigateur();
      if (!supabase) return { ok: true };
      const resultat = await enregistrerProfilCloud(
        supabase,
        utilisateurIdRef.current,
        profil,
        suivant.plateformesChoisies,
        suivant.testTermine,
      );
      if (!resultat.ok) signalerErreurEcriture(resultat.erreur ?? 'La sauvegarde a échoué.');
      return resultat;
    },
    [connecte, signalerErreurEcriture],
  );

  const majProfil = useCallback<ValeurContexte['majProfil']>(
    async (modification) => {
      const precedent = etatRef.current;
      if (!precedent.profil) return { ok: false, erreur: 'Aucun profil à modifier.' };
      return definirProfil({ ...precedent.profil, ...modification });
    },
    [definirProfil],
  );

  const signaler = useCallback<ValeurContexte['signaler']>(
    (titre, signal) => {
      const precedent = etatRef.current;
      if (!precedent.profil) return;

      const profilMisAJour = appliquerSignal(precedent.profil, titre, signal);
      const suivant: EtatApp = {
        ...precedent,
        profil: profilMisAJour,
        historique: enregistrerSignalLocal(precedent.historique, titre.id, signal),
        titresConnus: { ...precedent.titresConnus, [titre.id]: titre },
      };
      setEtat(suivant);

      if (!connecte || !utilisateurIdRef.current) return;
      const supabase = clientNavigateur();
      if (!supabase) return;
      void enregistrerSignalCloud(
        supabase,
        utilisateurIdRef.current,
        titre,
        signal,
        profilMisAJour,
        suivant.plateformesChoisies,
        suivant.testTermine,
      ).then((resultat) => {
        if (!resultat.ok) signalerErreurEcriture(resultat.erreur ?? 'La sauvegarde a échoué.');
      });
    },
    [connecte, signalerErreurEcriture],
  );

  const noterExpositions = useCallback<ValeurContexte['noterExpositions']>(
    (titres) => {
      if (titres.length === 0) return;
      const ids = titres.map((t) => t.id);
      setEtat((precedent) => ({
        ...precedent,
        historique: enregistrerExpositionsLocal(precedent.historique, ids),
      }));

      if (!connecte || !utilisateurIdRef.current) return;
      const supabase = clientNavigateur();
      if (!supabase) return;
      void enregistrerExpositionsCloud(supabase, ids).then((resultat) => {
        if (!resultat.ok) signalerErreurEcriture(resultat.erreur ?? 'La sauvegarde a échoué.');
      });
    },
    [connecte, signalerErreurEcriture],
  );

  const definirHumeur = useCallback<ValeurContexte['definirHumeur']>(
    (humeur) => {
      setContexte((precedent) => ({ ...precedent, humeur }));
      if (!humeur || !connecte || !utilisateurIdRef.current) return;
      const supabase = clientNavigateur();
      if (!supabase) return;
      // Signal fire-and-forget assumé : c'est un journal d'usage, pas une
      // donnée dont l'absence casserait quoi que ce soit pour la personne.
      void enregistrerHumeurCloud(supabase, utilisateurIdRef.current, humeur, contexte.compagnie);
    },
    // `contexte.compagnie` est lu au moment de l'appel : l'inclure en
    // dépendance garantit qu'on journalise la compagnie réellement en
    // vigueur, pas une valeur figée au premier rendu.
    [connecte, contexte.compagnie],
  );

  const definirCompagnie = useCallback((compagnie: Compagnie) => {
    setContexte((precedent) => ({ ...precedent, compagnie }));
  }, []);

  const reinitialiser = useCallback(() => {
    utilisateurIdRef.current = null;
    setEtat(ETAT_INITIAL);
    setErreurCompte(null);
    setErreurEcriture(null);
    try {
      window.localStorage.removeItem(CLE_STOCKAGE);
    } catch {
      /* rien à faire */
    }
  }, []);

  const reessayerChargement = useCallback(() => {
    if (utilisateurIdRef.current) void chargerDepuisLeCompte(utilisateurIdRef.current);
  }, [chargerDepuisLeCompte]);

  const effacerErreurEcriture = useCallback(() => setErreurEcriture(null), []);

  const valeur = useMemo<ValeurContexte>(
    () => ({
      ...etat,
      pret,
      contexte,
      connecte,
      emailCompte,
      erreurCompte,
      erreurEcriture,
      definirProfil,
      majProfil,
      signaler,
      noterExpositions,
      definirHumeur,
      definirCompagnie,
      reinitialiser,
      reessayerChargement,
      effacerErreurEcriture,
    }),
    [
      etat,
      pret,
      contexte,
      connecte,
      emailCompte,
      erreurCompte,
      erreurEcriture,
      definirProfil,
      majProfil,
      signaler,
      noterExpositions,
      definirHumeur,
      definirCompagnie,
      reinitialiser,
      reessayerChargement,
      effacerErreurEcriture,
    ],
  );

  return <ContexteApp.Provider value={valeur}>{children}</ContexteApp.Provider>;
}

/** Accès à l'état de l'app depuis n'importe quel composant client. */
export function useApp(): ValeurContexte {
  const valeur = useContext(ContexteApp);
  if (!valeur) throw new Error('useApp doit être utilisé à l’intérieur de <FournisseurApp>.');
  return valeur;
}
