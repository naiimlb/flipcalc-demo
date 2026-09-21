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

import { autoriseParAge, age as calculerAge, classificationMaximale } from './epoque.ts';
import { genererPourquoi } from './explication.ts';
import { injecterPepites, reclasserMMR } from './diversite.ts';
import type { Candidat } from './diversite.ts';
import { plateformesEffectives } from './plateformes.ts';
import { TABLE_COMPAGNIE } from './poids.ts';
import { affiniteGouts, scorerTitre } from './score.ts';
import type { Contexte, Historique, ProfilUtilisateur, Recommandation, Titre } from './types.ts';

export interface OptionsRecommandation {
  /** Nombre de titres souhaités (le cahier des charges demande 10 à 20). */
  taille?: number;
  /** Année de référence, injectable pour des tests déterministes. */
  anneeCourante?: number;
  /** Titres aimés, cités en référence dans « Pourquoi pour toi ». */
  titresAimes?: Titre[];
}

/** Motifs possibles d'un écran vide, pour proposer la bonne action. */
export type RaisonVide = 'aucune_plateforme' | 'filtres_trop_stricts' | 'catalogue_vide' | null;

export interface ResultatRecommandation {
  recommandations: Recommandation[];
  /** Nombre de titres ayant passé le filtrage strict. */
  candidatsRetenus: number;
  /** Taille du catalogue soumis au moteur. */
  catalogueTotal: number;
  raisonVide: RaisonVide;
}

/* ---------------------------------------------------------------------
   1. Filtrage strict — ces règles ne sont JAMAIS contournées.
   --------------------------------------------------------------------- */

/**
 * Un titre indisponible sur les services de la personne n'est jamais
 * proposé, et un mineur ne voit jamais de contenu qui lui est interdit.
 * Ces deux règles sont des exclusions dures, pas des pénalités.
 */
export function filtrerStrict(
  catalogue: Titre[],
  profil: ProfilUtilisateur,
  contexte: Contexte,
  anneeCourante: number,
): Titre[] {
  const autorisees = new Set(plateformesEffectives(profil.plateformes));
  const ageUtilisateur = calculerAge(profil.anneeNaissance, anneeCourante);
  const plafondCompagnie = TABLE_COMPAGNIE[contexte.compagnie]?.classificationMax ?? null;
  const plafond = classificationMaximale(ageUtilisateur, plafondCompagnie);
  const plafondAge = ageMinimumDe(plafond);

  return catalogue.filter((titre) => {
    // a. Disponibilité sur au moins une plateforme de la personne.
    if (!titre.plateformes.some((p) => autorisees.has(p))) return false;

    // b. Classification d'âge : âge réel ET contrainte de compagnie.
    if (!autoriseParAge(titre, ageUtilisateur)) return false;
    if (!autoriseParAge(titre, plafondAge)) return false;

    // c. Type de contenu souhaité (films, séries, ou les deux).
    if (!profil.typesSouhaites.includes(titre.type)) return false;

    // d. Animation refusée au test.
    if (!profil.animationOk && titre.animation) return false;

    return true;
  });
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

  if (catalogue.length === 0) {
    return { recommandations: [], candidatsRetenus: 0, catalogueTotal: 0, raisonVide: 'catalogue_vide' };
  }

  // --- Étape 1 : filtrage strict --------------------------------------
  const eligibles = filtrerStrict(catalogue, profil, contexte, anneeCourante);
  if (eligibles.length === 0) {
    return {
      recommandations: [],
      candidatsRetenus: 0,
      catalogueTotal: catalogue.length,
      raisonVide: profil.plateformes.length === 0 ? 'aucune_plateforme' : 'filtres_trop_stricts',
    };
  }

  // --- Étape 2 : scoring ----------------------------------------------
  const candidats: Candidat[] = eligibles.map((titre) => {
    const { score, detail } = scorerTitre(titre, profil, historique, contexte, anneeCourante);
    return { titre, score, affinite: detail.gouts, detail };
  });

  // Les titres lourdement pénalisés (refusés, détestés, déjà mal notés)
  // sortent de la course : inutile de les faire concourir.
  const enCourse = candidats.filter((c) => c.score > 0);
  const base = enCourse.length >= taille ? enCourse : candidats;

  // --- Étape 3 : re-classement MMR ------------------------------------
  // On classe large (3× la taille) pour laisser de la matière aux pépites.
  const selection = reclasserMMR(base, Math.min(base.length, taille * 3));

  // --- Étape 4 : pépites ----------------------------------------------
  const { liste, idsPepites } = injecterPepites(selection, base, taille);

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
  const eligibles = filtrerStrict(catalogue, profil, { ...contexte, humeur: null }, anneeCourante);
  return eligibles
    .map((titre) => {
      const { score, detail } = scorerTitre(titre, profil, historique, { ...contexte, humeur: null }, anneeCourante);
      return {
        titre,
        score,
        detail,
        pepite: false,
        pourquoi: genererPourquoi(titre, detail, profil, { ...contexte, humeur: null }, { anneeCourante }),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Affinité brute d'un titre : utilisée par l'écran « Ma liste ». */
export function affiniteBrute(titre: Titre, profil: ProfilUtilisateur): number {
  return affiniteGouts(titre, profil).score;
}
