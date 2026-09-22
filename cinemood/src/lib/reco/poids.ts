/* =====================================================================
   poids.ts — TOUTES les constantes de pondération de l'algorithme.
   ---------------------------------------------------------------------
   C'est le seul fichier à toucher pour régler le comportement du moteur :
   rendre les recommandations plus audacieuses, plus nostalgiques, plus
   sévères sur la qualité… Chaque valeur est commentée avec son effet.
   ===================================================================== */

import type { Classification, Humeur, Rythme, Tonalite } from './types.ts';

/* ---------------------------------------------------------------------
   1. Poids des cinq composantes du score final.
   La somme des composantes positives vaut 1 : le score brut d'un titre
   « parfait » sans pénalité vaut donc 1.
   --------------------------------------------------------------------- */
export const POIDS_SCORE = {
  /** Affinité avec le vecteur de goûts (genres, gens, mots-clés…). */
  gouts: 0.40,
  /**
   * Bonus de génération : nostalgie + culture de sa tranche d'âge.
   * Relevé de 0,14 à 0,18 : à 0,14, un profil de 15 ans et un profil de
   * 45 ans partageant une plateforme recevaient des titres communs, ce
   * que l'adaptation à l'époque est précisément censée éviter.
   */
  epoque: 0.18,
  /** Adéquation avec l'humeur et le contexte du moment. */
  humeur: 0.24,
  /** Qualité perçue : note TMDB amortie par le nombre de votes. */
  qualite: 0.12,
  /** Fraîcheur et tendance : évite un catalogue figé dans le passé. */
  fraicheur: 0.06,
} as const;

/**
 * Répartition appliquée quand la personne a EXPLICITEMENT choisi une
 * humeur sur l'écran d'accueil.
 *
 * Pourquoi deux répartitions : sans ce basculement, un profil au goût
 * très marqué (quelqu'un qui n'aime que le drame, par exemple) reçoit
 * quasiment la même liste qu'il se dise « fatigué » ou « à cran » — le
 * terme de goûts écrase tout. Or choisir une humeur est un acte
 * volontaire : il doit se voir. Le poids passe donc de 0,24 à 0,36,
 * prélevé surtout sur les goûts.
 */
export const POIDS_SCORE_HUMEUR_CHOISIE = {
  gouts: 0.32,
  epoque: 0.17,
  humeur: 0.36,
  qualite: 0.10,
  fraicheur: 0.05,
} as const;

/* ---------------------------------------------------------------------
   2. Poids internes de l'affinité de goûts.
   Une facette absente du titre ne pénalise pas : on renormalise sur les
   facettes réellement renseignées.
   --------------------------------------------------------------------- */
export const POIDS_FACETTES = {
  genres: 0.34,
  motsCles: 0.2,
  realisateurs: 0.12,
  acteurs: 0.1,
  tonalites: 0.14,
  decennies: 0.06,
  pays: 0.04,
} as const;

/* ---------------------------------------------------------------------
   3. Pénalités. Elles se soustraient au score final (échelle 0-1).
   Une pénalité ≥ 1 sort de fait le titre de la sélection.
   --------------------------------------------------------------------- */
export const PENALITES = {
  /** Déjà vu et aimé : on peut le reproposer, mais rarement. */
  dejaVuAime: 0.55,
  /** Déjà vu et pas aimé : quasi éliminatoire. */
  dejaVuPasAime: 1.5,
  /** « Pas pour moi » explicite. */
  refuse: 1.5,
  /** Déjà dans « Ma liste » : inutile de le reproposer en accueil. */
  dansLaListe: 0.8,
  /** Par genre détesté présent sur le titre. */
  parGenreDeteste: 0.45,
  /** Par exposition passée, plafonnée (voir `expositionMax`). */
  parExposition: 0.09,
  expositionMax: 0.36,
  /** Proposé il y a moins de `FENETRE_ROTATION_MS` : rotation. */
  rotationRecente: 0.5,
  /** Dépassement de la durée maximale souhaitée (par tranche de 30 min). */
  parTranche30minDeTrop: 0.22,
  /** Le titre n'est pas dans la langue d'origine préférée. */
  languePreferee: 0.06,
  /** Un sujet listé dans « à éviter » apparaît dans les mots-clés. */
  sujetAEviter: 1.5,
  /**
   * Aucune bande-annonce intégrable connue. Appliquée UNIQUEMENT quand le
   * catalogue en fournit pour d'autres titres : en mode démo, aucun titre
   * n'en a, la pénalité serait alors universelle donc inutile.
   */
  sansBandeAnnonce: 0.3,
} as const;

/** Durée pendant laquelle un titre déjà proposé reste pénalisé (7 jours). */
export const FENETRE_ROTATION_MS = 7 * 24 * 60 * 60 * 1000;

/* ---------------------------------------------------------------------
   4. Époque et génération.
   --------------------------------------------------------------------- */
export const EPOQUE = {
  /** Fenêtre de nostalgie : âge de début et de fin (inclus). */
  ageNostalgieDebut: 8,
  ageNostalgieFin: 20,
  /** Bonus maximal au cœur de la fenêtre de nostalgie. */
  bonusNostalgie: 1,
  /** Bonus pour la « culture de génération » (sorti avant ses 8 ans mais
      emblématique, ou juste après ses 20 ans). */
  bonusCultureGeneration: 0.55,
  /** Bonus plancher accordé aux sorties des 3 dernières années, pour ne
      jamais enfermer quelqu'un dans son passé. */
  bonusActualite: 0.62,
  /** Années récentes considérées comme « actualité ». */
  fenetreActualiteAnnees: 3,
  /** Fenêtre, plus large, de ce qui compte comme « nouveauté » à l'écran. */
  fenetreNouveautesAnnees: 8,
  /** Multiplicateur appliqué si la personne a déclaré préférer le récent. */
  multiPreferenceRecent: 1.35,
  multiPreferenceClassique: 1.35,
} as const;

/* ---------------------------------------------------------------------
   5. Qualité et fraîcheur.
   --------------------------------------------------------------------- */
export const QUALITE = {
  /** Nombre de votes à partir duquel une note est pleinement crédible
      (amortissement bayésien). */
  votesCredibles: 1200,
  /** Note moyenne de repli quand un titre a très peu de votes. */
  notePrior: 6.3,
  /** En dessous, la note ne rapporte rien (échelle 0-10). */
  notePlancher: 4.5,
} as const;

export const FRAICHEUR = {
  /** Demi-vie de la fraîcheur, en années. */
  demiVieAnnees: 4,
  /** Part de la popularité brute dans la note de fraîcheur. */
  partPopularite: 0.4,
} as const;

/* ---------------------------------------------------------------------
   6. Diversité et découverte (re-classement de type MMR).
   --------------------------------------------------------------------- */
export const DIVERSITE = {
  /** λ du MMR : 1 = pertinence pure, 0 = diversité pure. */
  lambda: 0.72,
  /** Part de « pépites » dans la sélection finale (15 à 20 %). */
  partPepites: 0.18,
  /** Au-dessus de ce seuil de popularité, un titre n'est plus une pépite. */
  populariteMaxPepite: 45,
  /** Affinité minimale exigée d'une pépite : surprendre, pas déranger. */
  affiniteMinPepite: 0.34,
  /** Nombre maximal de titres partageant le même genre principal. */
  maxParGenrePrincipal: 3,
  /**
   * Quota relevé pour un genre que la personne a explicitement coché
   * comme adoré au test.
   *
   * Sans cette distinction, la diversité se retourne contre le goût :
   * quelqu'un qui déclare n'aimer que l'animation japonaise recevait
   * sept titres hors de son genre, choisis sur leur seule qualité — et
   * se retrouvait avec la même liste qu'un profil qui n'a rien à voir
   * avec le sien. Varier à l'intérieur de ce qu'on aime, oui ; imposer
   * ce qu'on n'a pas demandé, non.
   */
  maxParGenreAdore: 4,
  /** Nombre maximal de titres du même réalisateur. */
  maxParRealisateur: 1,
  /**
   * Part minimale de la sélection devant toucher au moins un genre que
   * la personne a explicitement déclaré aimer — quand le catalogue le
   * permet.
   *
   * Pourquoi ce plancher. Le quota par genre principal protège de la
   * monotonie, mais il se retournait contre le goût : quelqu'un qui
   * n'aime que l'animation japonaise voyait ses anime plafonnés à
   * quatre, les six places restantes étant comblées par les titres les
   * mieux notés de sa plateforme — c'est-à-dire exactement ceux que
   * TOUT LE MONDE reçoit. Deux profils que rien ne rapproche se
   * retrouvaient alors avec un tiers de titres communs.
   *
   * 0,7 laisse de la place aux pépites (≈ 0,18) et à la respiration.
   */
  plancherPertinence: 0.75,
  /**
   * Plafond d'affichage : part maximale de la sélection portant le même
   * genre tel qu'il s'affiche sur la carte. Volontairement plus bas que
   * le plancher de pertinence, pour que « rester dans ses goûts » ne
   * veuille pas dire « dix fois la même chose ».
   */
  plafondGenreAffichage: 0.6,
  /**
   * Part minimale de sorties récentes dans la sélection, quand le vivier
   * en contient. Contrepoids direct au bonus de nostalgie : sans lui, un
   * profil dont la fenêtre de jeunesse est bien fournie ne recevait QUE
   * des titres de vingt ans d'âge — exactement ce que le cahier des
   * charges interdit.
   */
  plancherActualite: 0.2,
} as const;

/* ---------------------------------------------------------------------
   7. Apprentissage continu : de combien chaque signal déplace les poids.
   Les signaux négatifs pèsent autant que les positifs (cf. cahier des
   charges), d'où des amplitudes symétriques.
   --------------------------------------------------------------------- */
export const APPRENTISSAGE = {
  /** Amplitude du déplacement par type de signal. */
  amplitudes: {
    ajout_liste: 0.12,
    retrait_liste: -0.06,
    bande_annonce: 0.05,
    ouverture_fiche: 0.02,
    deja_vu_aime: 0.16,
    deja_vu_pas_aime: -0.16,
    pas_pour_moi: -0.12,
    swipe_garde: 0.08,
    swipe_passe: -0.08,
  } as Record<string, number>,
  /** Part de l'amplitude reçue par chaque facette. */
  partFacette: {
    genres: 1,
    motsCles: 0.55,
    realisateurs: 0.8,
    acteurs: 0.45,
    tonalites: 0.7,
    decennies: 0.35,
    pays: 0.25,
  } as Record<string, number>,
  /** Bornes dures du vecteur de goûts. */
  poidsMin: -1,
  poidsMax: 1,
  /** Nombre maximal de mots-clés d'un titre pris en compte par signal. */
  motsClesParSignal: 6,
} as const;

/* ---------------------------------------------------------------------
   8. Humeur → genres, tonalités, rythme et durée.
   `genres` liste les genres bonifiés ; `genresMalus` ceux qui cassent
   l'ambiance recherchée.
   --------------------------------------------------------------------- */
export interface ReglageHumeur {
  libelle: string;
  emoji: string;
  genres: string[];
  genresMalus: string[];
  tonalites: Tonalite[];
  rythmes: Rythme[];
  /** Durée idéale en minutes ; le score décroît en s'en éloignant. */
  dureeIdeale: number;
  /** Tolérance autour de la durée idéale, en minutes. */
  toleranceDuree: number;
}

export const TABLE_HUMEURS: Record<Humeur, ReglageHumeur> = {
  fatigue: {
    libelle: 'Fatigué',
    emoji: '🥱',
    genres: ['Comédie', 'Animation', 'Familial', 'Documentaire'],
    genresMalus: ['Horreur', 'Guerre', 'Thriller'],
    tonalites: ['leger'],
    rythmes: ['lent', 'modere'],
    dureeIdeale: 95,
    toleranceDuree: 25,
  },
  joyeux: {
    libelle: 'Joyeux',
    emoji: '😄',
    genres: ['Comédie', 'Aventure', 'Musique', 'Familial'],
    genresMalus: ['Drame', 'Horreur'],
    tonalites: ['leger', 'emouvant'],
    rythmes: ['modere', 'rapide'],
    dureeIdeale: 110,
    toleranceDuree: 35,
  },
  triste: {
    libelle: 'Triste',
    emoji: '🥺',
    genres: ['Drame', 'Romance', 'Animation'],
    genresMalus: ['Horreur', 'Guerre'],
    tonalites: ['emouvant'],
    rythmes: ['lent', 'modere'],
    dureeIdeale: 115,
    toleranceDuree: 35,
  },
  adrenaline: {
    libelle: 'Adrénaline',
    emoji: '⚡️',
    genres: ['Action', 'Thriller', 'Crime', 'Science-Fiction'],
    genresMalus: ['Romance', 'Documentaire'],
    tonalites: ['intense'],
    rythmes: ['rapide'],
    dureeIdeale: 125,
    toleranceDuree: 40,
  },
  rire: {
    libelle: 'Rire',
    emoji: '😂',
    genres: ['Comédie', 'Familial', 'Animation'],
    genresMalus: ['Drame', 'Horreur', 'Guerre'],
    tonalites: ['leger'],
    rythmes: ['modere', 'rapide'],
    dureeIdeale: 100,
    toleranceDuree: 28,
  },
  romantique: {
    libelle: 'Romantique',
    emoji: '💘',
    genres: ['Romance', 'Drame', 'Comédie'],
    genresMalus: ['Horreur', 'Guerre'],
    tonalites: ['emouvant', 'leger'],
    rythmes: ['lent', 'modere'],
    dureeIdeale: 110,
    toleranceDuree: 30,
  },
  reflexion: {
    libelle: 'Réflexion',
    emoji: '🧠',
    genres: ['Drame', 'Science-Fiction', 'Documentaire', 'Mystère', 'Histoire'],
    genresMalus: ['Comédie'],
    tonalites: ['reflechi', 'intense'],
    rythmes: ['lent', 'modere'],
    dureeIdeale: 130,
    toleranceDuree: 45,
  },
  evasion: {
    libelle: 'Évasion',
    emoji: '🌍',
    genres: ['Aventure', 'Fantastique', 'Science-Fiction', 'Animation'],
    genresMalus: ['Documentaire'],
    tonalites: ['leger', 'intense'],
    rythmes: ['modere', 'rapide'],
    dureeIdeale: 125,
    toleranceDuree: 40,
  },
  frisson: {
    libelle: 'Frissons',
    emoji: '😱',
    genres: ['Horreur', 'Thriller', 'Mystère'],
    genresMalus: ['Familial', 'Comédie'],
    tonalites: ['flippant', 'intense'],
    rythmes: ['modere', 'rapide'],
    dureeIdeale: 105,
    toleranceDuree: 30,
  },
};

/* ---------------------------------------------------------------------
   9. Contexte : heure, jour, compagnie.
   --------------------------------------------------------------------- */
export const CONTEXTE = {
  /** À partir de cette heure, on privilégie les formats courts. */
  heureTardive: 22,
  /** Durée idéale imposée quand il est tard. */
  dureeIdealeTardive: 100,
  /** Poids du critère durée quand il est tard (sinon `poidsDureeNormal`). */
  poidsDureeTardive: 0.34,
  poidsDureeNormal: 0.16,
  /** Le week-end, on tolère les formats longs. */
  bonusWeekendFormatLong: 0.1,
  /** Minutes à partir desquelles un film est « long ». */
  seuilFilmLong: 140,
} as const;

/** Réglages par compagnie. */
export interface ReglageCompagnie {
  libelle: string;
  emoji: string;
  /** Classification maximale autorisée. `null` = pas de plafond propre. */
  classificationMax: Classification | null;
  genresBonus: string[];
  tonalitesBonus: Tonalite[];
}

export const TABLE_COMPAGNIE: Record<string, ReglageCompagnie> = {
  seul: { libelle: 'Seul', emoji: '🧘', classificationMax: null, genresBonus: [], tonalitesBonus: [] },
  couple: {
    libelle: 'En couple',
    emoji: '💞',
    classificationMax: null,
    genresBonus: ['Romance', 'Drame', 'Comédie'],
    tonalitesBonus: ['emouvant'],
  },
  potes: {
    libelle: 'Entre potes',
    emoji: '🍕',
    classificationMax: null,
    genresBonus: ['Comédie', 'Action', 'Horreur', 'Aventure'],
    tonalitesBonus: ['leger', 'intense'],
  },
  famille: {
    libelle: 'En famille',
    emoji: '👨‍👩‍👧',
    // Une soirée en famille impose le tout public : règle stricte.
    classificationMax: '10',
    genresBonus: ['Familial', 'Animation', 'Aventure', 'Comédie'],
    tonalitesBonus: ['leger', 'emouvant'],
  },
};

/* ---------------------------------------------------------------------
   10. Âge et classification.
   --------------------------------------------------------------------- */
/** Échelle ordonnée du plus permissif au plus restrictif. */
export const ECHELLE_AGE: Classification[] = ['TP', '10', '12', '16', '18'];

/** Âge minimum requis pour chaque classification. */
export const AGE_MINIMUM: Record<Classification, number> = {
  TP: 0,
  '10': 10,
  '12': 12,
  '16': 16,
  '18': 18,
};
