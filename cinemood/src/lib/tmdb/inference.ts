/* =====================================================================
   inference.ts — Ce que TMDB ne fournit pas, on le déduit.
   ---------------------------------------------------------------------
   TMDB donne des genres et des mots-clés, mais ni « tonalité » ni
   « rythme » — deux notions dont le moteur a besoin pour coller à une
   humeur. On les infère par des règles simples et documentées, plutôt
   que de faire semblant d'avoir une donnée qu'on n'a pas.
   ===================================================================== */

import type { Classification, Rythme, Tonalite } from '@/lib/reco/types';

/** Genres qui tirent vers chaque tonalité. */
const TONALITE_PAR_GENRE: Record<string, Tonalite[]> = {
  Comédie: ['leger'],
  Familial: ['leger'],
  Animation: ['leger'],
  Musique: ['leger', 'emouvant'],
  Aventure: ['leger', 'intense'],
  Action: ['intense'],
  Thriller: ['intense'],
  Crime: ['intense'],
  Guerre: ['intense', 'emouvant'],
  Western: ['intense'],
  Romance: ['emouvant'],
  Drame: ['emouvant'],
  Documentaire: ['reflechi'],
  Histoire: ['reflechi'],
  'Science-Fiction': ['reflechi', 'intense'],
  Mystère: ['reflechi', 'flippant'],
  Fantastique: ['leger', 'intense'],
  Horreur: ['flippant'],
};

/** Mots-clés qui, à eux seuls, orientent la tonalité. */
const TONALITE_PAR_MOT_CLE: Record<string, Tonalite> = {
  deuil: 'emouvant',
  amitié: 'emouvant',
  'tueur en série': 'flippant',
  fantômes: 'flippant',
  philosophie: 'reflechi',
  dystopie: 'reflechi',
  poursuite: 'intense',
  humour: 'leger',
};

/**
 * Déduit une à trois tonalités. On garde toujours au moins une valeur :
 * un titre sans tonalité serait invisible pour la plupart des humeurs.
 */
export function infererTonalites(genres: string[], motsCles: string[]): Tonalite[] {
  const compte = new Map<Tonalite, number>();
  const ajouter = (t: Tonalite, poids: number) => compte.set(t, (compte.get(t) ?? 0) + poids);

  for (const genre of genres) {
    for (const tonalite of TONALITE_PAR_GENRE[genre] ?? []) ajouter(tonalite, 2);
  }
  for (const mot of motsCles) {
    const tonalite = TONALITE_PAR_MOT_CLE[mot.toLowerCase()];
    if (tonalite) ajouter(tonalite, 1);
  }

  const classees = [...compte.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return classees.length ? classees.slice(0, 3) : ['reflechi'];
}

/** Genres qui imposent un rythme. */
const GENRES_RAPIDES = ['Action', 'Aventure', 'Thriller', 'Comédie'];
const GENRES_LENTS = ['Drame', 'Documentaire', 'Histoire', 'Romance', 'Mystère'];

/**
 * Déduit le rythme. La durée corrige le genre : un drame de 90 minutes
 * n'a pas le même tempo qu'un drame de trois heures.
 */
export function infererRythme(genres: string[], duree: number | null): Rythme {
  let score = 0;
  for (const genre of genres) {
    if (GENRES_RAPIDES.includes(genre)) score += 1;
    if (GENRES_LENTS.includes(genre)) score -= 1;
  }
  if (duree !== null) {
    if (duree >= 150) score -= 1;
    if (duree <= 100) score += 1;
  }
  if (score >= 2) return 'rapide';
  if (score <= -2) return 'lent';
  return 'modere';
}

/**
 * Normalise la classification d'âge française renvoyée par TMDB.
 * TMDB utilise « U », « TP », « 10 », « 12 », « 16 », « 18 » selon les
 * sources ; tout ce qui n'est pas reconnu est traité prudemment.
 */
export function normaliserClassification(brut: string | undefined | null, prudent = true): Classification {
  const valeur = (brut ?? '').trim().toUpperCase();
  if (['U', 'TP', 'TOUS PUBLICS', 'G', ''].includes(valeur)) {
    // Une classification absente est ambiguë : par défaut on protège les
    // mineurs plutôt que de supposer « tout public ».
    return valeur === '' && prudent ? '12' : 'TP';
  }
  if (valeur.includes('10')) return '10';
  if (valeur.includes('12')) return '12';
  if (valeur.includes('16')) return '16';
  if (valeur.includes('18') || valeur.includes('X')) return '18';
  return prudent ? '12' : 'TP';
}

/**
 * Ramène la popularité TMDB (non bornée, souvent 0-1000) sur 0-100.
 * Une saturation exponentielle évite qu'un blockbuster écrase tout.
 */
export function normaliserPopularite(populariteTmdb: number): number {
  return Math.round(100 * (1 - Math.exp(-Math.max(0, populariteTmdb) / 60)));
}
