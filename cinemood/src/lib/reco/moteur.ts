/* =====================================================================
   moteur.ts — Orchestration complète d'une session de recommandation.
   ---------------------------------------------------------------------
   Enchaînement :
     1. filtrage STRICT (plateformes, âge, type, animation) ;
     2. scoring de chaque candidat ;
     3. re-classement MMR + quotas de diversité ;
     4. injection des pépites ;
     5. génération de la phrase « Pourquoi pour toi ».
   ===================================================================== */

import {
  autoriseParAge,
  age as calculerAge,
  classificationMaximale,
  estNostalgique,
} from './epoque.ts';
import { genererPourquoi } from './explication.ts';
import {
  assurerPlancherActualite,
  assurerPlancherPertinence,
  injecterPepites,
  ordonnerPourAffichage,
  reclasserMMR,
  respecterQuotaGenre,
} from './diversite.ts';
import type { Candidat } from './diversite.ts';
import { plateformesEffectives } from './plateformes.ts';
import { EPOQUE, TABLE_COMPAGNIE } from './poids.ts';
import { affiniteGouts, scorerTitre } from './score.ts';
import type { Contexte, Historique, ProfilUtilisateur, Recommandation, Titre } from './types.ts';

export interface OptionsRecommandation {
  /** Nombre de titres souhaités (le cahier des charges demande 10 à 20). */
  taille?: number;
  /** Année de référence, injectable pour des tests déterministes. */
  anneeCourante?: number;
  /** Titres aimés, cités en référence dans « Pourquoi pour toi ». */
  titresAimes?: Titre[];
  /** Voir le paramètre de même nom sur `filtrerStrict`. */
  plateformesDejaFiltrees?: boolean;
  /**
   * Quand le filtrage complet ne laisse rien passer, réessayer en ne
   * gardant que `REGLES_NON_NEGOCIABLES` plutôt que rendre un écran vide.
   * Le résultat le signale via `preferencesRelachees`.
   */
  replierSiVide?: boolean;
}

/** Motifs possibles d'un écran vide, pour proposer la bonne action. */
export type RaisonVide = 'aucune_plateforme' | 'filtres_trop_stricts' | 'catalogue_vide' | null;

/** Une contrainte qui étrangle la sélection, et ce qu'elle coûte. */
export interface ContrainteLimitante {
  /** Identifiant technique, pour que l'interface propose la bonne action. */
  cle: 'plateformes' | 'compagnie' | 'genres_detestes' | 'animation' | 'duree' | 'types' | 'sujets_evites';
  /** Phrase prête à afficher. */
  libelle: string;
  /** Nombre de titres supplémentaires que sa levée débloquerait. */
  gain: number;
}

export interface ResultatRecommandation {
  recommandations: Recommandation[];
  /** Nombre de titres ayant passé le filtrage strict. */
  candidatsRetenus: number;
  /** Taille du catalogue soumis au moteur. */
  catalogueTotal: number;
  raisonVide: RaisonVide;
  /**
   * Renseigné quand la sélection est plus courte que demandé : les
   * contraintes à relâcher, de la plus rentable à la moins rentable.
   * L'interface peut alors proposer une action précise plutôt qu'un
   * message vague.
   */
  contraintesLimitantes: ContrainteLimitante[];
  /**
   * `true` si le filtrage complet ne laissait rien passer et que seules
   * les règles non négociables ont été appliquées. L'interface DOIT le
   * dire : ces titres ne respectent pas toutes les préférences.
   */
  preferencesRelachees: boolean;
  /** Combien de titres chaque règle a écartés. Vide hors diagnostic. */
  exclusions: Record<RegleStricte, number> | null;
}

/**
 * Identifie ce qui étrangle la sélection, en relâchant une contrainte à
 * la fois et en mesurant ce que cela débloquerait. On ne devine pas :
 * on mesure.
 */
export function contraintesLimitantes(
  catalogue: Titre[],
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
  anneeCourante: number,
  plateformesDejaFiltrees = false,
): ContrainteLimitante[] {
  const reference = filtrerStrict(
    catalogue, profil, historique, contexte, anneeCourante, plateformesDejaFiltrees,
  ).length;

  const essais: Array<{ cle: ContrainteLimitante['cle']; libelle: string; profil: ProfilUtilisateur; contexte: Contexte }> = [
    {
      cle: 'plateformes',
      libelle: 'Ajouter une plateforme',
      profil: { ...profil, plateformes: [] },
      contexte,
    },
    {
      cle: 'genres_detestes',
      libelle: `Rouvrir un des genres que tu évites (${profil.genresDetestes.join(', ')})`,
      profil: { ...profil, genresDetestes: [] },
      contexte,
    },
    { cle: 'animation', libelle: 'Accepter l’animation', profil: { ...profil, animationOk: true }, contexte },
    { cle: 'duree', libelle: 'Lever la durée maximale', profil: { ...profil, dureeMax: null }, contexte },
    { cle: 'types', libelle: 'Accepter films ET séries', profil: { ...profil, typesSouhaites: ['film', 'serie'] }, contexte },
    {
      cle: 'sujets_evites',
      libelle: 'Retirer un sujet de ta liste « à éviter »',
      profil: { ...profil, aEviter: [] },
      contexte,
    },
    { cle: 'compagnie', libelle: 'Regarder seul plutôt qu’en famille', profil, contexte: { ...contexte, compagnie: 'seul' } },
  ];

  return essais
    .map(({ cle, libelle, profil: p, contexte: c }) => ({
      cle,
      libelle,
      gain:
        filtrerStrict(catalogue, p, historique, c, anneeCourante, plateformesDejaFiltrees).length
        - reference,
    }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain);
}

/* ---------------------------------------------------------------------
   1. Filtrage strict — ces règles ne sont JAMAIS contournées.
   --------------------------------------------------------------------- */

/**
 * Les exclusions dures. Aucune de ces règles n'est négociable, et
 * aucune n'est exprimée en pénalité : un titre qui tombe ici ne peut
 * pas revenir dans la sélection, quel que soit son score par ailleurs.
 *
 * L'historique entre ici — et non plus seulement dans les pénalités —
 * parce qu'un titre déjà vu ou explicitement refusé ne doit JAMAIS
 * reparaître, pas seulement être désavantagé.
 */
export function filtrerStrict(
  catalogue: Titre[],
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
  anneeCourante: number,
  /**
   * `true` quand la source a DÉJÀ restreint le catalogue aux plateformes
   * de la personne — c'est le cas du vivier TMDB, obtenu via
   * `with_watch_providers`. Voir la règle (a) pour ce que cela change.
   */
  plateformesDejaFiltrees = false,
  /**
   * Règles à appliquer. Par défaut toutes. Restreindre cette liste sert
   * à deux choses, et à rien d'autre : diagnostiquer règle par règle, et
   * bâtir le repli quand le filtrage complet ne laisse rien passer.
   * `plateformes`, `age` et `deja_vu` ne sont JAMAIS retirées par le
   * repli — voir `REGLES_NON_NEGOCIABLES`.
   */
  regles: readonly RegleStricte[] = REGLES_TOUTES,
): Titre[] {
  const actives = new Set(regles);
  const autorisees = new Set(plateformesEffectives(profil.plateformes));
  const ageUtilisateur = calculerAge(profil.anneeNaissance, anneeCourante);
  const plafondCompagnie = TABLE_COMPAGNIE[contexte.compagnie]?.classificationMax ?? null;
  const plafond = classificationMaximale(ageUtilisateur, plafondCompagnie);
  const plafondAge = ageMinimumDe(plafond);
  const detestes = new Set(profil.genresDetestes);
  const refuses = new Set(historique.refuses);
  const aEviter = profil.aEviter
    .map((sujet) => sujet.trim().toLowerCase())
    .filter((sujet) => sujet.length > 2);

  return catalogue.filter((titre) => {
    // a. Disponibilité sur au moins une plateforme de la personne.
    //    Une liste vide ne veut pas dire la même chose partout : sur un
    //    catalogue complet elle signifie « disponible nulle part », mais
    //    sur le vivier TMDB elle signifie « pas encore renseigné » — les
    //    plateformes n'y arrivent qu'à l'enrichissement. Confondre les
    //    deux élimine l'intégralité du vivier avant même de l'enrichir.
    const plateformesInconnues = titre.plateformes.length === 0 && plateformesDejaFiltrees;
    if (actives.has('plateformes')
      && !plateformesInconnues && !titre.plateformes.some((p) => autorisees.has(p))) return false;

    // b. Classification d'âge : âge réel ET contrainte de compagnie.
    if (actives.has('age')) {
      if (!autoriseParAge(titre, ageUtilisateur)) return false;
      if (!autoriseParAge(titre, plafondAge)) return false;
    }

    // c. Type de contenu souhaité (films, séries, ou les deux).
    if (actives.has('type') && !profil.typesSouhaites.includes(titre.type)) return false;

    // d. Animation refusée au test.
    if (actives.has('animation') && !profil.animationOk && titre.animation) return false;

    // e. Genre explicitement détesté : exclusion, pas pénalité. Quelqu'un
    //    qui déclare ne pas supporter l'horreur ne doit pas en voir, même
    //    si le titre coche toutes les autres cases.
    if (actives.has('genres_detestes') && titre.genres.some((g) => detestes.has(g))) return false;

    // f. Déjà vu, ou refusé d'un « pas pour moi » : on ne le repropose pas.
    if (actives.has('deja_vu')) {
      if (historique.vus[titre.id] !== undefined) return false;
      if (refuses.has(titre.id)) return false;
    }

    // g. Sujet que la personne a demandé de ne jamais croiser.
    if (actives.has('sujets_evites') && aEviter.length > 0) {
      const corpus = [...titre.motsCles, ...titre.genres].map((x) => x.toLowerCase());
      if (aEviter.some((sujet) => corpus.some((mot) => mot.includes(sujet)))) return false;
    }

    return true;
  });
}

/** Les règles du filtrage strict, dans leur ordre d'application. */
export type RegleStricte =
  | 'plateformes' | 'age' | 'type' | 'animation' | 'genres_detestes' | 'deja_vu' | 'sujets_evites';

export const REGLES_TOUTES: readonly RegleStricte[] = [
  'plateformes', 'age', 'type', 'animation', 'genres_detestes', 'deja_vu', 'sujets_evites',
];

/**
 * Ce qu'aucun repli ne relâchera jamais, même pour éviter un écran vide :
 *  • `age` — proposer du 18 à un enfant serait un défaut autrement plus
 *    grave que de ne rien proposer ;
 *  • `plateformes` — un titre que la personne ne peut pas regarder n'est
 *    pas une proposition, c'est une frustration ;
 *  • `deja_vu` — reproposer ce qu'elle a explicitement écarté la ferait
 *    douter que l'app l'écoute.
 * Mieux vaut un écran vide honnête que ces trois-là contournés.
 */
export const REGLES_NON_NEGOCIABLES: readonly RegleStricte[] = ['plateformes', 'age', 'deja_vu'];

/**
 * Pour chaque titre écarté, LA règle qui l'a écarté en premier.
 * Sans cela, un écran vide ne dit pas ce qui l'a vidé : on ne peut que
 * deviner, et on accuse au hasard les critères de la personne.
 */
export function diagnostiquerFiltrage(
  catalogue: Titre[],
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
  anneeCourante: number,
  plateformesDejaFiltrees = false,
): Record<RegleStricte, number> {
  const comptes: Record<RegleStricte, number> = {
    plateformes: 0, age: 0, type: 0, animation: 0, genres_detestes: 0, deja_vu: 0, sujets_evites: 0,
  };

  for (const t of catalogue) {
    // Un titre à la fois, une règle à la fois : la première qui rejette
    // est celle qu'on compte, pour que la somme reste lisible.
    for (const regle of REGLES_TOUTES) {
      const survivants = filtrerStrict(
        [t], profil, historique, contexte, anneeCourante, plateformesDejaFiltrees, [regle],
      );
      if (survivants.length === 0) {
        comptes[regle] += 1;
        break;
      }
    }
  }
  return comptes;
}

/** Âge minimum associé à une classification, sans réimporter la table. */
function ageMinimumDe(classification: string): number {
  const table: Record<string, number> = { TP: 0, '10': 10, '12': 12, '16': 16, '18': 18 };
  return table[classification] ?? 18;
}

/* ---------------------------------------------------------------------
   2. Point d'entrée principal.
   --------------------------------------------------------------------- */

export function recommander(
  catalogue: Titre[],
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
  options: OptionsRecommandation = {},
): ResultatRecommandation {
  const taille = Math.max(1, Math.min(20, options.taille ?? 15));
  const anneeCourante = options.anneeCourante ?? new Date(contexte.maintenant).getFullYear();
  const plateformesDejaFiltrees = options.plateformesDejaFiltrees ?? false;

  if (catalogue.length === 0) {
    return {
      recommandations: [],
      candidatsRetenus: 0,
      catalogueTotal: 0,
      raisonVide: 'catalogue_vide',
      contraintesLimitantes: [],
      preferencesRelachees: false,
      exclusions: null,
    };
  }

  // Le catalogue porte-t-il des bandes-annonces ? En mode démo, non :
  // la pénalité correspondante serait alors universelle, donc inutile.
  const avecBandesAnnonces = catalogue.some((t) => t.bandeAnnonce !== null);

  // --- Étape 1 : filtrage strict --------------------------------------
  let preferencesRelachees = false;
  let eligibles = filtrerStrict(
    catalogue, profil, historique, contexte, anneeCourante, plateformesDejaFiltrees,
  );

  // Rien ne passe : plutôt qu'un écran vide, on retente en ne gardant
  // que les règles non négociables. Ce qui ressort respecte toujours les
  // plateformes, l'âge et les refus — seules les préférences cèdent.
  if (eligibles.length === 0 && (options.replierSiVide ?? false)) {
    const large = filtrerStrict(
      catalogue, profil, historique, contexte, anneeCourante, plateformesDejaFiltrees,
      REGLES_NON_NEGOCIABLES,
    );
    if (large.length > 0) {
      eligibles = large;
      preferencesRelachees = true;
    }
  }

  if (eligibles.length === 0) {
    return {
      recommandations: [],
      candidatsRetenus: 0,
      catalogueTotal: catalogue.length,
      raisonVide: profil.plateformes.length === 0 ? 'aucune_plateforme' : 'filtres_trop_stricts',
      contraintesLimitantes: contraintesLimitantes(
        catalogue, profil, historique, contexte, anneeCourante, plateformesDejaFiltrees,
      ),
      preferencesRelachees: false,
      exclusions: diagnostiquerFiltrage(
        catalogue, profil, historique, contexte, anneeCourante, plateformesDejaFiltrees,
      ),
    };
  }

  // --- Étape 2 : scoring ----------------------------------------------
  const candidats: Candidat[] = eligibles.map((titre) => {
    const { score, detail } = scorerTitre(titre, profil, historique, contexte, anneeCourante, {
      penaliserSansBandeAnnonce: avecBandesAnnonces,
    });
    return { titre, score, affinite: detail.gouts, detail };
  });

  // Les titres lourdement pénalisés (refusés, détestés, déjà mal notés)
  // sortent de la course : inutile de les faire concourir.
  const enCourse = candidats.filter((c) => c.score > 0);
  const base = enCourse.length >= taille ? enCourse : candidats;

  // --- Étape 3 : re-classement MMR ------------------------------------
  // On classe large (3× la taille) pour laisser de la matière aux pépites.
  const selection = reclasserMMR(base, Math.min(base.length, taille * 3), undefined, profil.genresAdores);

  // --- Étape 4 : pépites ----------------------------------------------
  const { liste: avecPepites, idsPepites } = injecterPepites(selection, base, taille);

  // --- Étape 4 bis : garantie finale de diversité ----------------------
  // Le MMR et l'injection de pépites peuvent, chacun de leur côté, laisser
  // filer le quota par genre. On le rétablit ici, une fois pour toutes.
  const apresQuota = respecterQuotaGenre(avecPepites, base, profil.genresAdores);

  // --- Étape 4 ter : plancher de pertinence ----------------------------
  // La diversité ne doit pas évincer le goût déclaré : au moins 70 % de
  // la liste touche un genre que la personne a coché.
  const apresPertinence = assurerPlancherPertinence(apresQuota, base, profil.genresAdores, idsPepites);

  // --- Étape 4 quater : plancher d'actualité ---------------------------
  // Le pendant du bonus de nostalgie : on ne laisse personne enfermé
  // dans sa propre décennie quand le catalogue offre mieux.
  const apresActualite = assurerPlancherActualite(
    apresPertinence,
    base,
    anneeCourante,
    EPOQUE.fenetreNouveautesAnnees,
    idsPepites,
    profil.genresAdores,
    (c) => estNostalgique(c.titre, profil),
  );

  // --- Étape 4 quinquies : ordre d'affichage ---------------------------
  const liste = ordonnerPourAffichage(apresActualite, idsPepites);

  // --- Étape 5 : explications -----------------------------------------
  const recommandations: Recommandation[] = liste.map((c, rang) => {
    // `detail` est toujours présent : il est posé à l'étape 2 et traverse
    // le MMR et l'injection de pépites sans être perdu.
    const detail = c.detail as Recommandation['detail'];
    const pepite = idsPepites.has(c.titre.id);
    return {
      titre: c.titre,
      score: c.score,
      detail,
      pepite,
      bandeAnnonceDisponible: c.titre.bandeAnnonce !== null,
      pourquoi: genererPourquoi(c.titre, detail, profil, contexte, {
        titresAimes: options.titresAimes,
        pepite,
        anneeCourante,
        variante: rang,
      }),
    };
  });

  return {
    recommandations,
    candidatsRetenus: eligibles.length,
    catalogueTotal: catalogue.length,
    raisonVide: recommandations.length === 0 ? 'filtres_trop_stricts' : null,
    // Sélection plus courte que demandé : on dit pourquoi, et quoi faire.
    contraintesLimitantes:
      recommandations.length < taille
        ? contraintesLimitantes(
            catalogue, profil, historique, contexte, anneeCourante, plateformesDejaFiltrees,
          )
        : [],
    preferencesRelachees,
    exclusions: null,
  };
}

/**
 * Variante « Découvrir » : même scoring, mais sans humeur ni pépites,
 * pour trier des résultats de recherche ou de filtres.
 */
export function classerPourDecouverte(
  catalogue: Titre[],
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
  anneeCourante: number = new Date().getFullYear(),
): Recommandation[] {
  const sansHumeur: Contexte = { ...contexte, humeur: null };
  const eligibles = filtrerStrict(catalogue, profil, historique, sansHumeur, anneeCourante);
  return eligibles
    .map((titre) => {
      const { score, detail } = scorerTitre(titre, profil, historique, sansHumeur, anneeCourante);
      return {
        titre,
        score,
        detail,
        pepite: false,
        bandeAnnonceDisponible: titre.bandeAnnonce !== null,
        pourquoi: genererPourquoi(titre, detail, profil, sansHumeur, { anneeCourante }),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Affinité brute d'un titre : utilisée par l'écran « Ma liste ». */
export function affiniteBrute(titre: Titre, profil: ProfilUtilisateur): number {
  return affiniteGouts(titre, profil).score;
}
