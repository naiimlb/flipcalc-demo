'use client';

/* =====================================================================
   magasin.tsx — L'état de l'application, partagé par tous les écrans.
   ---------------------------------------------------------------------
   Stratégie de persistance, volontairement simple et robuste :

     • l'appareil est la source de vérité pendant la session (localStorage),
       ce qui rend l'app instantanée et utilisable hors ligne ;
     • si Supabase est configuré ET qu'une session existe, l'état est
       synchronisé en arrière-plan, pour retrouver son profil sur un autre
       appareil.

   L'app reste donc entièrement fonctionnelle sans compte et sans réseau.
   ===================================================================== */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { appliquerSignal, enregistrerExpositions, enregistrerSignal, historiqueVide } from '@/lib/reco/profil';
import { contexteParDefaut } from '@/lib/reco/humeur';
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

interface ValeurContexte extends EtatApp {
  /** `false` tant que le localStorage n'a pas été relu. */
  pret: boolean;
  contexte: Contexte;
  /** `true` si un compte Supabase est connecté. */
  connecte: boolean;
  definirProfil: (profil: ProfilUtilisateur, options?: { testTermine?: boolean; plateformesChoisies?: boolean }) => void;
  majProfil: (modification: Partial<ProfilUtilisateur>) => void;
  signaler: (titre: Titre, signal: Signal) => void;
  noterExpositions: (titres: Titre[]) => void;
  definirHumeur: (humeur: Humeur | null) => void;
  definirCompagnie: (compagnie: Compagnie) => void;
  reinitialiser: () => void;
}

const ContexteApp = createContext<ValeurContexte | null>(null);

const ETAT_INITIAL: EtatApp = {
  profil: null,
  historique: historiqueVide(),
  titresConnus: {},
  testTermine: false,
  plateformesChoisies: false,
};

export function FournisseurApp({ children }: { children: React.ReactNode }) {
  const [etat, setEtat] = useState<EtatApp>(ETAT_INITIAL);
  const [pret, setPret] = useState(false);
  const [connecte, setConnecte] = useState(false);
  const [contexte, setContexte] = useState<Contexte>(() => contexteParDefaut());
  const premierRendu = useRef(true);

  /* --- 1. Relecture depuis l'appareil ------------------------------- */
  useEffect(() => {
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
      }
    } catch {
      // Navigation privée, quota plein, données corrompues : on repart
      // d'un état vierge plutôt que de bloquer l'app.
    } finally {
      setPret(true);
      setContexte(contexteParDefaut());
    }
  }, []);

  /* --- 2. Sauvegarde sur l'appareil --------------------------------- */
  useEffect(() => {
    if (!pret) return;
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
    } catch {
      // Quota dépassé : l'app continue, seule la persistance est perdue.
    }
  }, [etat, pret]);

  /* --- 3. Synchronisation Supabase, si disponible -------------------- */
  useEffect(() => {
    if (!SUPABASE_CONFIGURE) return;
    const supabase = clientNavigateur();
    if (!supabase) return;

    let actif = true;
    supabase.auth.getUser().then(({ data }) => {
      if (actif) setConnecte(Boolean(data.user));
    });
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, session) => {
      setConnecte(Boolean(session?.user));
    });
    return () => {
      actif = false;
      abonnement.subscription.unsubscribe();
    };
  }, []);

  // Pousse le profil vers Supabase, sans bloquer l'interface.
  const synchroniser = useCallback(async (suivant: EtatApp) => {
    if (!SUPABASE_CONFIGURE || !suivant.profil) return;
    const supabase = clientNavigateur();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const p = suivant.profil;
    await supabase.from('profils').upsert({
      id: data.user.id,
      pseudo: p.pseudo,
      annee_naissance: p.anneeNaissance,
      pays: p.pays,
      plateformes: p.plateformes,
      types_souhaites: p.typesSouhaites,
      genres_adores: p.genresAdores,
      genres_detestes: p.genresDetestes,
      tonalite_preferee: p.tonalitePreferee,
      duree_max: p.dureeMax,
      langue_preferee: p.languePreferee,
      epoque_preferee: p.epoquePreferee,
      animation_ok: p.animationOk,
      a_eviter: p.aEviter,
      interets: p.interets,
      gouts: p.gouts,
      plateformes_ok: suivant.plateformesChoisies,
      test_termine: suivant.testTermine,
    });
  }, []);

  /* --- 4. Actions ---------------------------------------------------- */
  const definirProfil = useCallback<ValeurContexte['definirProfil']>(
    (profil, options) => {
      setEtat((precedent) => {
        const suivant: EtatApp = {
          ...precedent,
          profil,
          testTermine: options?.testTermine ?? precedent.testTermine,
          plateformesChoisies: options?.plateformesChoisies ?? precedent.plateformesChoisies,
        };
        void synchroniser(suivant);
        return suivant;
      });
    },
    [synchroniser],
  );

  const majProfil = useCallback<ValeurContexte['majProfil']>(
    (modification) => {
      setEtat((precedent) => {
        if (!precedent.profil) return precedent;
        const suivant = { ...precedent, profil: { ...precedent.profil, ...modification } };
        void synchroniser(suivant);
        return suivant;
      });
    },
    [synchroniser],
  );

  const signaler = useCallback<ValeurContexte['signaler']>((titre, signal) => {
    setEtat((precedent) => {
      if (!precedent.profil) return precedent;
      const suivant: EtatApp = {
        ...precedent,
        profil: appliquerSignal(precedent.profil, titre, signal),
        historique: enregistrerSignal(precedent.historique, titre.id, signal),
        titresConnus: { ...precedent.titresConnus, [titre.id]: titre },
      };
      void journaliser(titre, signal);
      return suivant;
    });
  }, []);

  const noterExpositions = useCallback<ValeurContexte['noterExpositions']>((titres) => {
    if (titres.length === 0) return;
    setEtat((precedent) => ({
      ...precedent,
      historique: enregistrerExpositions(
        precedent.historique,
        titres.map((t) => t.id),
      ),
    }));
  }, []);

  const definirHumeur = useCallback((humeur: Humeur | null) => {
    setContexte((precedent) => ({ ...precedent, humeur }));
  }, []);

  const definirCompagnie = useCallback((compagnie: Compagnie) => {
    setContexte((precedent) => ({ ...precedent, compagnie }));
  }, []);

  const reinitialiser = useCallback(() => {
    setEtat(ETAT_INITIAL);
    try {
      window.localStorage.removeItem(CLE_STOCKAGE);
    } catch {
      /* rien à faire */
    }
  }, []);

  const valeur = useMemo<ValeurContexte>(
    () => ({
      ...etat,
      pret,
      contexte,
      connecte,
      definirProfil,
      majProfil,
      signaler,
      noterExpositions,
      definirHumeur,
      definirCompagnie,
      reinitialiser,
    }),
    [
      etat,
      pret,
      contexte,
      connecte,
      definirProfil,
      majProfil,
      signaler,
      noterExpositions,
      definirHumeur,
      definirCompagnie,
      reinitialiser,
    ],
  );

  return <ContexteApp.Provider value={valeur}>{children}</ContexteApp.Provider>;
}

/** Journalise l'interaction dans Supabase, si un compte est connecté. */
async function journaliser(titre: Titre, signal: Signal) {
  if (!SUPABASE_CONFIGURE) return;
  const supabase = clientNavigateur();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const utilisateur = data.user.id;

    await supabase.from('interactions').insert({ utilisateur_id: utilisateur, titre_id: titre.id, signal });

    if (signal === 'ajout_liste' || signal === 'swipe_garde') {
      await supabase.from('liste').upsert({
        utilisateur_id: utilisateur,
        titre_id: titre.id,
        statut: 'a_voir',
        titre_cache: titre,
      });
    } else if (signal === 'retrait_liste') {
      await supabase.from('liste').delete().match({ utilisateur_id: utilisateur, titre_id: titre.id });
    } else if (signal === 'deja_vu_aime' || signal === 'deja_vu_pas_aime') {
      await supabase.from('liste').upsert({
        utilisateur_id: utilisateur,
        titre_id: titre.id,
        statut: 'vu',
        appreciation: signal === 'deja_vu_aime' ? 1 : -1,
        titre_cache: titre,
      });
    }
  } catch {
    // La synchronisation est un confort : son échec ne doit jamais
    // remonter jusqu'à l'utilisateur.
  }
}

/** Accès à l'état de l'app depuis n'importe quel composant client. */
export function useApp(): ValeurContexte {
  const valeur = useContext(ContexteApp);
  if (!valeur) throw new Error('useApp doit être utilisé à l’intérieur de <FournisseurApp>.');
  return valeur;
}
