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

/**
 * TMDB délivre DEUX identifiants, et les confondre est l'erreur la plus
 * courante de toute intégration :
 *   • « API Key (v3) » — 32 caractères hexadécimaux, qui se passe en
 *     paramètre `?api_key=` ;
 *   • « API Read Access Token (v4) » — un JWT `eyJ…`, qui se passe en
 *     en-tête `Authorization: Bearer`.
 * Envoyer l'un à la place de l'autre donne un 401 sur CHAQUE appel, donc
 * un catalogue entièrement vide. Plutôt que d'exiger le bon, on
 * reconnaît celui qu'on a reçu.
 */
function formatDeJeton(jeton: string): 'v4' | 'v3' {
  return jeton.split('.').length === 3 ? 'v4' : 'v3';
}

/** Lit la configuration TMDB dans l'environnement, sans jamais la logger. */
export function configTmdb(): ConfigTmdb | null {
  // Un « Bearer » collé par mégarde avec le jeton ferait échouer l'en-tête.
  const jeton = process.env.TMDB_ACCESS_TOKEN?.trim().replace(/^Bearer\s+/i, '');
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

  const entetes: Record<string, string> = { accept: 'application/json' };
  if (formatDeJeton(config.jeton) === 'v4') {
    entetes.Authorization = `Bearer ${config.jeton}`;
  } else {
    url.searchParams.set('api_key', config.jeton);
  }

  const reponse = await fetch(url, { headers: entetes, next: { revalidate } });

  if (!reponse.ok) {
    // On ne renvoie jamais le corps brut de TMDB au client : il peut
    // contenir des détails inutiles. Un message et un statut suffisent.
    // Le format du jeton est précisé sur un 401 : c'est LA cause la plus
    // fréquente, et sans elle on cherche du côté des filtres pour rien.
    const indice = reponse.status === 401 ? ` (jeton reconnu comme ${formatDeJeton(config.jeton)})` : '';
    throw new ErreurTmdb(`TMDB a répondu ${reponse.status} sur ${chemin}${indice}`, reponse.status);
  }

  return (await reponse.json()) as T;
}

/** URL d'une affiche TMDB. `w500` est le bon compromis pour un iPhone. */
export function urlAffiche(chemin: string | null, taille: 'w342' | 'w500' | 'w780' = 'w500'): string | null {
  return chemin ? `https://image.tmdb.org/t/p/${taille}${chemin}` : null;
}
