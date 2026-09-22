/* =====================================================================
   mappage.ts — Conversion pure entre les lignes Supabase et le domaine.
   ---------------------------------------------------------------------
   Aucune dépendance à `@supabase/*` ici : ce module ne fait que
   transformer des objets JSON en `ProfilUtilisateur` / `Historique` et
   inversement. C'est ce qui le rend testable avec le lanceur natif de
   Node, exactement comme `src/lib/reco/`.

   Principe de défense : une ligne corrompue ou partielle (colonne
   manquante, JSON invalide) ne doit jamais faire planter l'app — elle
   doit dégrader vers une valeur par défaut plutôt que de propager
   `undefined` dans le moteur de recommandation.
   ===================================================================== */

import { vecteurVide } from '../reco/profil.ts';
import type {
  Historique,
  PreferenceEpoque,
  PreferenceLangue,
  ProfilUtilisateur,
  Titre,
  Tonalite,
  TypeContenu,
  VecteurGouts,
} from '../reco/types.ts';

/* ---------------------------------------------------------------------
   1. Formes brutes des lignes, telles que Supabase les renvoie.
   Les colonnes sont en snake_case côté SQL ; le domaine est en
   camelCase. Ce fichier est la seule frontière entre les deux.
   --------------------------------------------------------------------- */

export interface LigneProfil {
  id: string;
  pseudo: string | null;
  annee_naissance: number | null;
  genre_personne: string | null;
  pays: string | null;
  plateformes: string[] | null;
  types_souhaites: string[] | null;
  genres_adores: string[] | null;
  genres_detestes: string[] | null;
  tonalite_preferee: string | null;
  duree_max: number | null;
  langue_preferee: string | null;
  epoque_preferee: string | null;
  animation_ok: boolean | null;
  a_eviter: string[] | null;
  interets: string[] | null;
  gouts: unknown;
  plateformes_ok: boolean | null;
  test_termine: boolean | null;
}

export interface LigneListe {
  titre_id: string;
  statut: 'a_voir' | 'vu' | string;
  appreciation: 1 | -1 | null;
  titre_cache: unknown;
}

export interface LigneExposition {
  titre_id: string;
  nb: number;
  /** Horodatage ISO renvoyé par Postgres pour une colonne `timestamptz`. */
  derniere: string;
}

export interface LigneRefus {
  titre_id: string;
}

/* ---------------------------------------------------------------------
   2. Profil : profil du domaine → ligne, et ligne → profil du domaine.
   --------------------------------------------------------------------- */

const TONALITES: Tonalite[] = ['leger', 'intense', 'emouvant', 'reflechi', 'flippant'];
const LANGUES: PreferenceLangue[] = ['vo', 'vf', 'indifferent'];
const EPOQUES: PreferenceEpoque[] = ['recent', 'classique', 'indifferent'];

/**
 * Le profil à écrire dans `public.profils`. `id` est l'identifiant
 * Supabase de la personne connectée — jamais stocké dans
 * `ProfilUtilisateur`, qui ignore tout de l'authentification.
 */
export function versLigneProfil(
  id: string,
  profil: ProfilUtilisateur,
  plateformesChoisies: boolean,
  testTermine: boolean,
): Record<string, unknown> {
  return {
    id,
    pseudo: profil.pseudo,
    annee_naissance: profil.anneeNaissance,
    genre_personne: profil.genrePersonne ?? null,
    pays: profil.pays,
    plateformes: profil.plateformes,
    types_souhaites: profil.typesSouhaites,
    genres_adores: profil.genresAdores,
    genres_detestes: profil.genresDetestes,
    tonalite_preferee: profil.tonalitePreferee,
    duree_max: profil.dureeMax,
    langue_preferee: profil.languePreferee,
    epoque_preferee: profil.epoquePreferee,
    animation_ok: profil.animationOk,
    a_eviter: profil.aEviter,
    interets: profil.interets,
    gouts: profil.gouts,
    plateformes_ok: plateformesChoisies,
    test_termine: testTermine,
  };
}

/** Un vecteur de goûts sûr, même si la colonne `gouts` est corrompue. */
function versVecteurGouts(valeur: unknown): VecteurGouts {
  const vide = vecteurVide();
  if (!valeur || typeof valeur !== 'object') return vide;
  const brut = valeur as Record<string, unknown>;

  const carte = (cle: keyof VecteurGouts): Record<string, number> => {
    const source = brut[cle];
    if (!source || typeof source !== 'object') return {};
    const resultat: Record<string, number> = {};
    for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) resultat[k] = v;
    }
    return resultat;
  };

  return {
    genres: carte('genres'),
    motsCles: carte('motsCles'),
    realisateurs: carte('realisateurs'),
    acteurs: carte('acteurs'),
    pays: carte('pays'),
    decennies: carte('decennies'),
    tonalites: carte('tonalites'),
  };
}

/**
 * Reconstruit un `ProfilUtilisateur` depuis une ligne `profils`.
 * `null` si la ligne elle-même est absente (compte flambant neuf avant
 * que le déclencheur d'inscription n'ait eu le temps de s'exécuter —
 * cas rarissime, mais qu'il vaut mieux ne pas laisser planter l'app).
 */
export function depuisLigneProfil(ligne: LigneProfil | null): ProfilUtilisateur | null {
  if (!ligne) return null;
  const anneeCourante = new Date().getFullYear();

  const tonalite = TONALITES.includes(ligne.tonalite_preferee as Tonalite)
    ? (ligne.tonalite_preferee as Tonalite)
    : 'intense';
  const langue = LANGUES.includes(ligne.langue_preferee as PreferenceLangue)
    ? (ligne.langue_preferee as PreferenceLangue)
    : 'indifferent';
  const epoque = EPOQUES.includes(ligne.epoque_preferee as PreferenceEpoque)
    ? (ligne.epoque_preferee as PreferenceEpoque)
    : 'indifferent';
  const types = (ligne.types_souhaites ?? []).filter(
    (t): t is TypeContenu => t === 'film' || t === 'serie',
  );

  return {
    pseudo: ligne.pseudo ?? '',
    anneeNaissance: ligne.annee_naissance ?? anneeCourante - 30,
    genrePersonne: ligne.genre_personne ?? undefined,
    typesSouhaites: types.length ? types : ['film', 'serie'],
    genresAdores: ligne.genres_adores ?? [],
    genresDetestes: ligne.genres_detestes ?? [],
    tonalitePreferee: tonalite,
    dureeMax: ligne.duree_max,
    languePreferee: langue,
    epoquePreferee: epoque,
    animationOk: ligne.animation_ok ?? true,
    plateformes: ligne.plateformes ?? [],
    pays: ligne.pays || 'FR',
    gouts: versVecteurGouts(ligne.gouts),
    aEviter: ligne.a_eviter ?? [],
    interets: ligne.interets ?? [],
  };
}

/* ---------------------------------------------------------------------
   3. Historique et cache des titres, reconstruits depuis trois tables.
   --------------------------------------------------------------------- */

/**
 * Reconstruit l'historique complet à partir des lignes `liste`, des
 * identifiants `refus` et des lignes `expositions`. C'est l'inverse
 * exact de ce que chaque signal écrit : voir `compte.ts`.
 */
export function construireHistorique(
  lignesListe: LigneListe[],
  idsRefus: string[],
  lignesExposition: LigneExposition[],
): Historique {
  const vus: Record<string, 1 | -1> = {};
  const liste: string[] = [];

  for (const ligne of lignesListe) {
    if (ligne.statut === 'vu') {
      if (ligne.appreciation === 1 || ligne.appreciation === -1) vus[ligne.titre_id] = ligne.appreciation;
    } else if (ligne.statut === 'a_voir') {
      liste.push(ligne.titre_id);
    }
  }

  const expositions: Record<string, number> = {};
  const derniereProposition: Record<string, number> = {};
  for (const ligne of lignesExposition) {
    expositions[ligne.titre_id] = ligne.nb;
    const instant = Date.parse(ligne.derniere);
    if (!Number.isNaN(instant)) derniereProposition[ligne.titre_id] = instant;
  }

  return {
    vus,
    refuses: [...idsRefus],
    liste,
    expositions,
    derniereProposition,
  };
}

/** `true` si l'objet a la forme minimale d'un `Titre` exploitable. */
function estTitreValide(valeur: unknown): valeur is Titre {
  if (!valeur || typeof valeur !== 'object') return false;
  const t = valeur as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.titre === 'string' && Array.isArray(t.genres);
}

/**
 * Reconstruit le cache de titres à partir des lignes `liste` : c'est le
 * seul endroit où les fiches complètes (affiche, synopsis…) sont
 * conservées côté serveur, via `titre_cache`.
 */
export function titresConnusDepuisListe(lignesListe: LigneListe[]): Record<string, Titre> {
  const resultat: Record<string, Titre> = {};
  for (const ligne of lignesListe) {
    if (estTitreValide(ligne.titre_cache)) resultat[ligne.titre_id] = ligne.titre_cache;
  }
  return resultat;
}
