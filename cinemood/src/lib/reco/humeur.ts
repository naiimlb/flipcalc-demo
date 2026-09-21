/* =====================================================================
   humeur.ts — Correspondance humeur × contexte × titre.
   ---------------------------------------------------------------------
   Produit un score entre 0 et 1 qui dit « à quel point ce titre colle au
   moment ». Trois ingrédients : les genres/tonalités de l'humeur, le
   rythme, et la durée — la durée pesant plus lourd tard le soir.
   ===================================================================== */

import { CONTEXTE, TABLE_COMPAGNIE, TABLE_HUMEURS } from './poids.ts';
import type { Contexte, Titre } from './types.ts';

/** Durée effective d'un titre : un épisode de série vaut ~45 min. */
export function dureeEffective(titre: Titre): number {
  if (titre.type === 'film') return titre.duree ?? 110;
  return titre.duree ?? 45;
}

/** Score de proximité à une durée idéale, décroissance linéaire bornée. */
export function scoreDuree(duree: number, ideale: number, tolerance: number): number {
  const ecart = Math.abs(duree - ideale);
  if (ecart <= tolerance) return 1;
  // Au-delà de la tolérance, on perd tout sur trois fois la tolérance.
  return Math.max(0, 1 - (ecart - tolerance) / (tolerance * 3));
}

/** Part d'une liste présente dans une autre (0 à 1). */
function recouvrement(liste: string[], reference: string[]): number {
  if (reference.length === 0 || liste.length === 0) return 0;
  const set = new Set(reference);
  const touches = liste.filter((x) => set.has(x)).length;
  return Math.min(1, touches / Math.min(reference.length, 2));
}

/**
 * Score humeur + contexte d'un titre, entre 0 et 1.
 *
 * Sans humeur sélectionnée, on renvoie un score neutre haut (0.6) pour
 * ne pas écraser le reste du calcul : l'app reste utilisable sans choisir
 * d'humeur.
 */
export function scoreHumeur(titre: Titre, contexte: Contexte): number {
  const compagnie = TABLE_COMPAGNIE[contexte.compagnie] ?? TABLE_COMPAGNIE.seul;
  const tard = contexte.heure >= CONTEXTE.heureTardive || contexte.heure < 5;
  const weekend = contexte.jour === 0 || contexte.jour === 5 || contexte.jour === 6;

  // --- Volet durée, commun à tous les cas ------------------------------
  const reglage = contexte.humeur ? TABLE_HUMEURS[contexte.humeur] : null;
  const dureeIdeale = tard
    ? Math.min(CONTEXTE.dureeIdealeTardive, reglage?.dureeIdeale ?? CONTEXTE.dureeIdealeTardive)
    : (reglage?.dureeIdeale ?? 115);
  const tolerance = reglage?.toleranceDuree ?? 40;
  let voletDuree = scoreDuree(dureeEffective(titre), dureeIdeale, tolerance);

  // Le week-end, on pardonne les formats longs.
  if (weekend && dureeEffective(titre) >= CONTEXTE.seuilFilmLong) {
    voletDuree = Math.min(1, voletDuree + CONTEXTE.bonusWeekendFormatLong);
  }
  const poidsDuree = tard ? CONTEXTE.poidsDureeTardive : CONTEXTE.poidsDureeNormal;

  // --- Volet compagnie -------------------------------------------------
  const voletCompagnie = Math.max(
    recouvrement(titre.genres, compagnie.genresBonus),
    recouvrement(titre.tonalites, compagnie.tonalitesBonus),
  );

  if (!reglage) {
    // Pas d'humeur choisie : durée + compagnie, sur une base neutre.
    return clamp01(0.6 * (1 - poidsDuree) + poidsDuree * voletDuree + 0.12 * voletCompagnie);
  }

  // --- Volet humeur ----------------------------------------------------
  const voletGenres = recouvrement(titre.genres, reglage.genres);
  const voletTonalites = recouvrement(titre.tonalites, reglage.tonalites);
  const voletRythme = reglage.rythmes.includes(titre.rythme) ? 1 : 0;
  const malus = titre.genres.some((g) => reglage.genresMalus.includes(g)) ? 0.28 : 0;

  const coeur = 0.46 * voletGenres + 0.28 * voletTonalites + 0.26 * voletRythme;

  const total =
    (1 - poidsDuree) * coeur + poidsDuree * voletDuree + 0.1 * voletCompagnie - malus;

  return clamp01(total);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Contexte par défaut, déduit de l'horloge. */
export function contexteParDefaut(maintenant: number = Date.now()): Contexte {
  const d = new Date(maintenant);
  return {
    humeur: null,
    compagnie: 'seul',
    heure: d.getHours(),
    jour: d.getDay(),
    maintenant,
  };
}
