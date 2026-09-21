/* =====================================================================
   genres.ts — Vocabulaire de genres unifié films / séries.
   ---------------------------------------------------------------------
   TMDB n'utilise pas les mêmes identifiants pour les films et pour les
   séries (« Action & Adventure » n'existe que côté séries). On ramène
   tout à un vocabulaire unique, celui que manipule le moteur.
   ===================================================================== */

/** Identifiants TMDB « film » → libellé français. */
export const GENRES_FILM: Record<number, string> = {
  28: 'Action',
  12: 'Aventure',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  14: 'Fantastique',
  36: 'Histoire',
  27: 'Horreur',
  10402: 'Musique',
  9648: 'Mystère',
  10749: 'Romance',
  878: 'Science-Fiction',
  10770: 'Téléfilm',
  53: 'Thriller',
  10752: 'Guerre',
  37: 'Western',
};

/** Identifiants TMDB « série » → même vocabulaire. */
export const GENRES_SERIE: Record<number, string> = {
  10759: 'Action',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  10762: 'Familial',
  9648: 'Mystère',
  10763: 'Documentaire',
  10764: 'Documentaire',
  10765: 'Science-Fiction',
  10766: 'Drame',
  10767: 'Documentaire',
  10768: 'Guerre',
  37: 'Western',
};

/** Liste ordonnée des genres proposés dans l'interface. */
export const GENRES_PROPOSES: string[] = [
  'Action',
  'Animation',
  'Aventure',
  'Comédie',
  'Crime',
  'Documentaire',
  'Drame',
  'Familial',
  'Fantastique',
  'Guerre',
  'Histoire',
  'Horreur',
  'Musique',
  'Mystère',
  'Romance',
  'Science-Fiction',
  'Thriller',
  'Western',
];

/** Convertit une liste d'identifiants TMDB en libellés, sans doublon. */
export function genresDepuisIds(ids: number[], type: 'film' | 'serie'): string[] {
  const table = type === 'film' ? GENRES_FILM : GENRES_SERIE;
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const id of ids) {
    const nom = table[id];
    if (nom && !vus.has(nom)) {
      vus.add(nom);
      resultat.push(nom);
    }
  }
  return resultat;
}

/** Identifiant TMDB d'un genre, pour filtrer côté API. */
export function idDepuisGenre(nom: string, type: 'film' | 'serie'): number | null {
  const table = type === 'film' ? GENRES_FILM : GENRES_SERIE;
  for (const [id, libelle] of Object.entries(table)) {
    if (libelle === nom) return Number(id);
  }
  return null;
}
