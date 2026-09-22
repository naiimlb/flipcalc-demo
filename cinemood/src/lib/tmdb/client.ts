/* =====================================================================
   client.ts — Accès à l'API TMDB. SERVEUR UNIQUEMENT.
   ---------------------------------------------------------------------
   `import 'server-only'` garantit qu'une erreur de build survient si ce
   module est importé par un composant client : le jeton TMDB ne peut
   donc pas fuir dans le bundle envoyé au navigateur.

   Mise en cache : on s'appuie sur le cache de `fetch` de Next.js
   (`next.revalidate`), qui déduplique les appels identiques et sert les
   réponses depuis le disque entre deux rendus.
   ===================================================================== */

import 'server-only';

const BASE = 'https://api.themoviedb.org/3';

/** Durées de cache, en secondes. */
export const DUREES_CACHE = {
  /** Fiches, crédits, mots-clés : très stables. */
  fiche: 60 * 60 * 24 * 7,
  /** Disponibilités streaming : changent, mais pas toutes les heures. */
  plateformes: 60 * 60 * 12,
  /** Listes de découverte et tendances. */
  listes: 60 * 60 * 6,
  /** Recherche : courte, pour rester réactif. */
  recherche: 60 * 30,
} as const;

export interface ConfigTmdb {
  jeton: string;
  region: string;
  langue: string;
}

/** Lit la configuration TMDB dans l'environnement, sans jamais la logger. */
export function configTmdb(): ConfigTmdb | null {
  const jeton = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (!jeton) return null;
  return {
    jeton,
    region: process.env.TMDB_REGION?.trim() || 'FR',
    langue: process.env.TMDB_LANGUE?.trim() || 'fr-FR',
  };
}

/** `true` si l'app tourne sur le catalogue local faute de jeton TMDB. */
export function modeDemo(): boolean {
  return configTmdb() === null;
}

export class ErreurTmdb extends Error {
  readonly statut: number;
  constructor(message: string, statut: number) {
    super(message);
    this.name = 'ErreurTmdb';
    this.statut = statut;
  }
}

/**
 * Appel générique à TMDB.
 * @param chemin  chemin relatif, ex. `/movie/550`
 * @param params  paramètres de requête additionnels
 * @param revalidate  durée de cache en secondes
 */
export async function tmdb<T>(
  chemin: string,
  params: Record<string, string | number | undefined> = {},
  revalidate: number = DUREES_CACHE.fiche,
): Promise<T> {
  const config = configTmdb();
  if (!config) throw new ErreurTmdb('TMDB_ACCESS_TOKEN absent', 500);

  const url = new URL(BASE + chemin);
  url.searchParams.set('language', config.langue);
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur !== undefined && valeur !== '') url.searchParams.set(cle, String(valeur));
  }

  const reponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.jeton}`,
      accept: 'application/json',
    },
    next: { revalidate },
  });

  if (!reponse.ok) {
    // On ne renvoie jamais le corps brut de TMDB au client : il peut
    // contenir des détails inutiles. Un message et un statut suffisent.
    throw new ErreurTmdb(`TMDB a répondu ${reponse.status} sur ${chemin}`, reponse.status);
  }

  return (await reponse.json()) as T;
}

/** URL d'une affiche TMDB. `w500` est le bon compromis pour un iPhone. */
export function urlAffiche(chemin: string | null, taille: 'w342' | 'w500' | 'w780' = 'w500'): string | null {
  return chemin ? `https://image.tmdb.org/t/p/${taille}${chemin}` : null;
}
