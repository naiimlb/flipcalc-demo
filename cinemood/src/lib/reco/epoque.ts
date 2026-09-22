/* =====================================================================
   epoque.ts — Adaptation à la génération de l'utilisateur.
   ---------------------------------------------------------------------
   Trois idées :
     • la nostalgie : ce qui est sorti quand il avait 8 à 20 ans ;
     • la culture de génération : les titres emblématiques de sa tranche ;
     • l'équilibre : les nouveautés gardent toujours un bonus plancher,
       pour ne jamais enfermer quelqu'un dans son passé.
   ===================================================================== */

import { AGE_MINIMUM, ECHELLE_AGE, EPOQUE } from './poids.ts';
import type { Classification, ProfilUtilisateur, Titre } from './types.ts';

/** Le nom de génération correspondant à une année de naissance. */
export function generation(anneeNaissance: number): string {
  if (anneeNaissance <= 1964) return 'Baby-boomer';
  if (anneeNaissance <= 1980) return 'Génération X';
  if (anneeNaissance <= 1996) return 'Millennial';
  if (anneeNaissance <= 2010) return 'Génération Z';
  return 'Génération Alpha';
}

/** L'âge de la personne au moment de la sortie d'un titre. */
export function ageALaSortie(anneeNaissance: number, anneeSortie: number): number {
  return anneeSortie - anneeNaissance;
}

/** Âge actuel, calculé sur l'année de référence. */
export function age(anneeNaissance: number, anneeCourante: number): number {
  return anneeCourante - anneeNaissance;
}

/**
 * Bonus d'époque, entre 0 et 1.
 *
 * Forme de la courbe :
 *   • plateau à `bonusNostalgie` entre 8 et 20 ans ;
 *   • décroissance douce de part et d'autre jusqu'à
 *     `bonusCultureGeneration` ;
 *   • plancher `bonusActualite` pour les sorties très récentes, qui
 *     l'emporte toujours sur le reste (mélange équilibré passé/présent).
 */
export function bonusEpoque(titre: Titre, profil: ProfilUtilisateur, anneeCourante: number): number {
  const ageSortie = ageALaSortie(profil.anneeNaissance, titre.annee);
  const { ageNostalgieDebut, ageNostalgieFin } = EPOQUE;

  let bonus: number;
  if (ageSortie >= ageNostalgieDebut && ageSortie <= ageNostalgieFin) {
    // Cœur de la fenêtre : nostalgie maximale.
    bonus = EPOQUE.bonusNostalgie;
  } else if (ageSortie < ageNostalgieDebut) {
    // Sorti avant ses 8 ans : culture de génération, d'autant plus forte
    // qu'on est proche de la fenêtre (il l'a vu « en rattrapage »).
    const distance = ageNostalgieDebut - ageSortie;
    bonus = EPOQUE.bonusCultureGeneration * Math.max(0, 1 - distance / 25);
  } else {
    // Sorti après ses 20 ans : on redescend progressivement.
    const distance = ageSortie - ageNostalgieFin;
    bonus = EPOQUE.bonusCultureGeneration * Math.max(0, 1 - distance / 30);
  }

  // Plancher d'actualité : une sortie des 3 dernières années garde
  // toujours un bonus décent, quel que soit l'âge de la personne.
  const anciennete = anneeCourante - titre.annee;
  if (anciennete >= 0 && anciennete <= EPOQUE.fenetreActualiteAnnees) {
    bonus = Math.max(bonus, EPOQUE.bonusActualite);
  }

  // Préférence déclarée au test : récent ou classique.
  if (profil.epoquePreferee === 'recent' && anciennete <= 8) {
    bonus *= EPOQUE.multiPreferenceRecent;
  } else if (profil.epoquePreferee === 'classique' && anciennete >= 20) {
    bonus *= EPOQUE.multiPreferenceClassique;
  }

  return Math.max(0, Math.min(1, bonus));
}

/** `true` si le titre tombe dans la fenêtre de nostalgie de la personne. */
export function estNostalgique(titre: Titre, profil: ProfilUtilisateur): boolean {
  const a = ageALaSortie(profil.anneeNaissance, titre.annee);
  return a >= EPOQUE.ageNostalgieDebut && a <= EPOQUE.ageNostalgieFin;
}

/* ---------------------------------------------------------------------
   Classification d'âge : filtrage strict, jamais contournable.
   --------------------------------------------------------------------- */

/** Compare deux classifications selon l'échelle française. */
export function classificationPlusStricte(a: Classification, b: Classification): boolean {
  return ECHELLE_AGE.indexOf(a) > ECHELLE_AGE.indexOf(b);
}

/**
 * `true` si le titre est autorisé pour cet âge.
 * Un mineur ne verra jamais de contenu -16 ou -18 proposé.
 */
export function autoriseParAge(titre: Titre, ageUtilisateur: number): boolean {
  return ageUtilisateur >= AGE_MINIMUM[titre.classification];
}

/**
 * Classification maximale autorisée, en croisant l'âge de la personne et
 * la contrainte de compagnie (une soirée en famille plafonne à « 10 »).
 */
export function classificationMaximale(
  ageUtilisateur: number,
  plafondCompagnie: Classification | null,
): Classification {
  let maxi: Classification = 'TP';
  for (const cran of ECHELLE_AGE) {
    if (ageUtilisateur >= AGE_MINIMUM[cran]) maxi = cran;
  }
  if (plafondCompagnie && classificationPlusStricte(maxi, plafondCompagnie)) {
    return plafondCompagnie;
  }
  return maxi;
}
