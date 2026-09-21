/* =====================================================================
   types.ts — Le vocabulaire du domaine CinéMood.
   Aucune dépendance : ce module est lisible par Next.js ET par le
   lanceur de tests natif de Node (`node --test`).
   ===================================================================== */

/** Un titre est soit un film, soit une série. */
export type TypeContenu = 'film' | 'serie';

/** Les cinq tonalités proposées à la fin du test de personnalité. */
export type Tonalite = 'leger' | 'intense' | 'emouvant' | 'reflechi' | 'flippant';

/** Rythme perçu du récit : sert à coller à l'énergie du moment. */
export type Rythme = 'lent' | 'modere' | 'rapide';

/** Humeurs proposées sur l'écran d'accueil. */
export type Humeur =
  | 'fatigue'
  | 'joyeux'
  | 'triste'
  | 'adrenaline'
  | 'rire'
  | 'romantique'
  | 'reflexion'
  | 'evasion'
  | 'frisson';

/** Avec qui la personne regarde : change la sévérité du filtrage. */
export type Compagnie = 'seul' | 'couple' | 'potes' | 'famille';

/**
 * Classification d'âge, alignée sur le visa d'exploitation français.
 * `TP` = tous publics. L'ordre du tableau `ECHELLE_AGE` fait foi.
 */
export type Classification = 'TP' | '10' | '12' | '16' | '18';

/** Préférence linguistique déclarée au test. */
export type PreferenceLangue = 'vo' | 'vf' | 'indifferent';

/** Préférence d'époque déclarée au test. */
export type PreferenceEpoque = 'recent' | 'classique' | 'indifferent';

/**
 * Un titre normalisé. Qu'il vienne de TMDB ou du catalogue de démonstration,
 * le moteur ne voit jamais que cette forme-là.
 */
export interface Titre {
  /** Identifiant stable, de la forme `film:550`. */
  id: string;
  tmdbId: number;
  type: TypeContenu;
  titre: string;
  titreOriginal?: string;
  annee: number;
  /** Durée en minutes pour un film, `null` pour une série. */
  duree: number | null;
  /** Nombre de saisons pour une série, `null` pour un film. */
  saisons: number | null;
  genres: string[];
  motsCles: string[];
  realisateurs: string[];
  acteurs: string[];
  pays: string[];
  langueOriginale: string;
  /** Note TMDB sur 10. */
  note: number;
  nbVotes: number;
  /** Indice de popularité TMDB, normalisé 0-100 à l'import. */
  popularite: number;
  classification: Classification;
  /** Identifiants de plateformes (voir `src/data/plateformes.ts`). */
  plateformes: string[];
  synopsis: string;
  tonalites: Tonalite[];
  rythme: Rythme;
  /** Chemin d'affiche TMDB (`/abc.jpg`) ou `null` en mode démo. */
  affiche: string | null;
  /** Identifiant YouTube de la bande-annonce, si connu. */
  bandeAnnonce: string | null;
  animation: boolean;
}

/**
 * Le vecteur de goûts : des poids par facette, entre -1 (rejet) et +1
 * (adoration). Initialisé par le test de personnalité, puis déplacé par
 * chaque interaction.
 */
export interface VecteurGouts {
  genres: Record<string, number>;
  motsCles: Record<string, number>;
  realisateurs: Record<string, number>;
  acteurs: Record<string, number>;
  pays: Record<string, number>;
  /** Clés sous forme `1990`, `2000`… */
  decennies: Record<string, number>;
  tonalites: Record<string, number>;
}

/** Les facettes du vecteur de goûts, utile pour itérer proprement. */
export type FacetteGouts = keyof VecteurGouts;

/** Le profil complet d'un utilisateur. */
export interface ProfilUtilisateur {
  pseudo: string;
  anneeNaissance: number;
  /**
   * Réponse facultative à la question « genre » du test.
   * Elle n'entre dans AUCUN calcul de recommandation : elle est
   * conservée uniquement parce que la personne a choisi de la donner.
   */
  genrePersonne?: string;
  /** Types de contenus souhaités : films, séries, ou les deux. */
  typesSouhaites: TypeContenu[];
  genresAdores: string[];
  genresDetestes: string[];
  tonalitePreferee: Tonalite;
  /** Durée maximale acceptée, en minutes. `null` = pas de limite. */
  dureeMax: number | null;
  languePreferee: PreferenceLangue;
  epoquePreferee: PreferenceEpoque;
  animationOk: boolean;
  /** Plateformes possédées. Tableau vide = offres gratuites uniquement. */
  plateformes: string[];
  /** Code pays ISO 3166-1 (FR par défaut). */
  pays: string;
  gouts: VecteurGouts;
  /** Sujets que la personne a demandé d'éviter (champ libre du test). */
  aEviter: string[];
  interets: string[];
}

/** Les signaux que l'app renvoie au moteur. */
export type Signal =
  | 'ajout_liste'
  | 'retrait_liste'
  | 'bande_annonce'
  | 'ouverture_fiche'
  | 'deja_vu_aime'
  | 'deja_vu_pas_aime'
  | 'pas_pour_moi'
  | 'swipe_garde'
  | 'swipe_passe';

/** Mémoire des interactions, servant aux pénalités et à la rotation. */
export interface Historique {
  /** Titres vus et notés : `1` aimé, `-1` pas aimé. */
  vus: Record<string, 1 | -1>;
  /** Titres explicitement refusés (« pas pour moi », swipe passé). */
  refuses: string[];
  /** Titres déjà dans « Ma liste ». */
  liste: string[];
  /** Nombre de fois où le titre a été proposé. */
  expositions: Record<string, number>;
  /** Horodatage (ms) de la dernière proposition, pour la rotation. */
  derniereProposition: Record<string, number>;
}

/** Le contexte de visionnage du moment. */
export interface Contexte {
  humeur: Humeur | null;
  compagnie: Compagnie;
  /** Heure locale 0-23. */
  heure: number;
  /** 0 = dimanche … 6 = samedi. */
  jour: number;
  /** Horodatage de référence, injectable pour rendre les tests déterministes. */
  maintenant: number;
}

/** Le détail du score d'un titre : c'est lui qui rend l'algorithme lisible. */
export interface DetailScore {
  gouts: number;
  epoque: number;
  humeur: number;
  qualite: number;
  fraicheur: number;
  penalites: number;
  /** Facettes ayant le plus contribué, pour la phrase « Pourquoi pour toi ». */
  contributions: Array<{ facette: string; valeur: number; libelle: string }>;
}

/** Un titre recommandé, avec sa justification. */
export interface Recommandation {
  titre: Titre;
  score: number;
  detail: DetailScore;
  /** `true` si le titre a été injecté au titre de la découverte. */
  pepite: boolean;
  /** Phrase « Pourquoi pour toi » générée localement. */
  pourquoi: string;
}
