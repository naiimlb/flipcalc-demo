/* =====================================================================
   catalogue.ts — Construction du vivier de candidats depuis TMDB.
   SERVEUR UNIQUEMENT.
   ---------------------------------------------------------------------
   Stratégie en deux passes, pour rester rapide en 4G :

     Passe 1 — « vivier léger ».
       /discover renvoie 20 titres par page avec genres, note, popularité
       et date. C'est peu, mais assez pour que le moteur classe : les
       facettes absentes (mots-clés, casting) sont ignorées par le calcul
       d'affinité, elles ne pénalisent personne.
       Le filtrage plateformes ET la classification d'âge sont faits
       directement par l'API — donc jamais plus de titres interdits qui
       redescendent inutilement.

     Passe 2 — « enrichissement ».
       Seuls les titres réellement retenus (15 à 20) sont détaillés :
       durée, réalisateur, casting, mots-clés, bande-annonce,
       plateformes exactes. Une vingtaine d'appels, tous mis en cache.
   ===================================================================== */

import 'server-only';

import { DUREES_CACHE, tmdb } from './client';
import { genresDepuisIds } from './genres';
import { infererRythme, infererTonalites, normaliserClassification, normaliserPopularite } from './inference';
import { PLATEFORME_PAR_ID, PLATEFORME_PAR_ID_TMDB, plateformesEffectives } from '@/lib/reco/plateformes';
import type { Classification, Titre, TypeContenu } from '@/lib/reco/types';

/* ---------------------------------------------------------------------
   Formes brutes renvoyées par TMDB (uniquement ce qu'on consomme).
   --------------------------------------------------------------------- */
interface ResultatDecouverte {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  overview?: string;
  poster_path?: string | null;
  original_language?: string;
}

interface PageDecouverte {
  page: number;
  results: ResultatDecouverte[];
  total_pages: number;
}

/** Correspondance classification française → filtre TMDB. */
const FILTRE_CERTIFICATION: Record<Classification, string> = {
  TP: 'U',
  '10': '10',
  '12': '12',
  '16': '16',
  '18': '18',
};

export interface OptionsVivier {
  plateformes: string[];
  typesSouhaites: TypeContenu[];
  /** Classification maximale autorisée (âge + compagnie). */
  classificationMax: Classification;
  /** Nombre de pages à ramener par type (20 titres par page). */
  pages?: number;
  region?: string;
  /** Genres à privilégier, pour orienter la découverte vers l'humeur. */
  genresPrioritaires?: number[];
  /** Ne garder que les titres sortis après cette année. */
  anneeMin?: number;
}

/**
 * Construit le vivier de candidats. Les titres renvoyés sont « légers » :
 * ils n'ont ni casting, ni mots-clés, ni durée. Voir `enrichir()`.
 */
export async function vivierTmdb(options: OptionsVivier): Promise<Titre[]> {
  const region = options.region ?? process.env.TMDB_REGION ?? 'FR';
  const pages = options.pages ?? 3;
  const fournisseurs = plateformesEffectives(options.plateformes)
    .map((id) => PLATEFORME_PAR_ID[id]?.idTmdb)
    .filter((x): x is number => typeof x === 'number');

  if (fournisseurs.length === 0) return [];

  const travaux: Array<Promise<Titre[]>> = [];
  for (const type of options.typesSouhaites) {
    for (let page = 1; page <= pages; page += 1) {
      travaux.push(unePageDeDecouverte(type, page, fournisseurs, region, options));
    }
  }

  const lots = await Promise.all(travaux);
  // Dédoublonnage : un même titre peut remonter sur plusieurs pages.
  const parId = new Map<string, Titre>();
  for (const lot of lots) {
    for (const titre of lot) if (!parId.has(titre.id)) parId.set(titre.id, titre);
  }
  return [...parId.values()];
}

async function unePageDeDecouverte(
  type: TypeContenu,
  page: number,
  fournisseurs: number[],
  region: string,
  options: OptionsVivier,
): Promise<Titre[]> {
  const chemin = type === 'film' ? '/discover/movie' : '/discover/tv';
  const params: Record<string, string | number | undefined> = {
    page,
    watch_region: region,
    with_watch_providers: fournisseurs.join('|'),
    with_watch_monetization_types: 'flatrate|free|ads',
    'vote_count.gte': 80,
    sort_by: page <= 2 ? 'popularity.desc' : 'vote_average.desc',
    include_adult: 'false',
  };

  if (options.genresPrioritaires?.length) {
    params.with_genres = options.genresPrioritaires.join('|');
  }
  if (options.anneeMin) {
    if (type === 'film') params['primary_release_date.gte'] = `${options.anneeMin}-01-01`;
    else params['first_air_date.gte'] = `${options.anneeMin}-01-01`;
  }
  // Le filtrage d'âge est délégué à TMDB pour les films : plus fiable et
  // plus rapide que de tout ramener pour écarter ensuite.
  if (type === 'film') {
    params.certification_country = region;
    params['certification.lte'] = FILTRE_CERTIFICATION[options.classificationMax];
  }

  try {
    const reponse = await tmdb<PageDecouverte>(chemin, params, DUREES_CACHE.listes);
    return reponse.results.map((brut) => versTitreLeger(brut, type, options.classificationMax));
  } catch {
    // Une page qui échoue ne doit pas faire tomber toute la sélection.
    return [];
  }
}

/** Transforme un résultat de /discover en `Titre` partiel mais exploitable. */
function versTitreLeger(brut: ResultatDecouverte, type: TypeContenu, plafond: Classification): Titre {
  const date = brut.release_date || brut.first_air_date || '';
  const genres = genresDepuisIds(brut.genre_ids ?? [], type);

  return {
    id: `${type}:${brut.id}`,
    tmdbId: brut.id,
    type,
    titre: brut.title || brut.name || 'Sans titre',
    titreOriginal: brut.original_title || brut.original_name,
    annee: date ? Number(date.slice(0, 4)) : 0,
    duree: null,
    saisons: null,
    genres,
    motsCles: [],
    realisateurs: [],
    acteurs: [],
    pays: [],
    langueOriginale: brut.original_language ?? 'en',
    note: brut.vote_average ?? 0,
    nbVotes: brut.vote_count ?? 0,
    popularite: normaliserPopularite(brut.popularity ?? 0),
    // Pour les films, TMDB a déjà filtré : la classification réelle est au
    // pire le plafond demandé. Pour les séries, on reste prudent et on
    // corrigera à l'enrichissement.
    classification: type === 'film' ? plafond : '12',
    plateformes: [],
    synopsis: brut.overview ?? '',
    tonalites: infererTonalites(genres, []),
    rythme: infererRythme(genres, null),
    affiche: brut.poster_path ?? null,
    bandeAnnonce: null,
    animation: genres.includes('Animation'),
  };
}

/* ---------------------------------------------------------------------
   Passe 2 : enrichissement des titres finalement retenus.
   --------------------------------------------------------------------- */

interface FicheDetaillee {
  id: number;
  title?: string;
  name?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string }>;
  origin_country?: string[];
  credits?: { crew?: Array<{ job?: string; name: string }>; cast?: Array<{ name: string }> };
  aggregate_credits?: { cast?: Array<{ name: string }> };
  created_by?: Array<{ name: string }>;
  keywords?: { keywords?: Array<{ name: string }>; results?: Array<{ name: string }> };
  videos?: { results?: Array<{ key: string; site: string; type: string; official?: boolean }> };
  release_dates?: { results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> };
  content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> };
  'watch/providers'?: {
    results?: Record<string, { flatrate?: Array<{ provider_id: number }>; free?: Array<{ provider_id: number }>; ads?: Array<{ provider_id: number }> }>;
  };
}

/**
 * Complète un titre léger avec tout ce que l'interface doit afficher.
 * Les erreurs sont absorbées : mieux vaut une carte un peu pauvre qu'une
 * sélection qui casse.
 */
export async function enrichirTitre(titre: Titre, region = process.env.TMDB_REGION ?? 'FR'): Promise<Titre> {
  const chemin = titre.type === 'film' ? `/movie/${titre.tmdbId}` : `/tv/${titre.tmdbId}`;
  const append =
    titre.type === 'film'
      ? 'credits,keywords,videos,release_dates,watch/providers'
      : 'aggregate_credits,keywords,videos,content_ratings,watch/providers';

  let fiche: FicheDetaillee;
  try {
    fiche = await tmdb<FicheDetaillee>(chemin, { append_to_response: append }, DUREES_CACHE.fiche);
  } catch {
    return titre;
  }

  const genres = fiche.genres?.map((g) => g.name) ?? titre.genres;
  const motsCles = (fiche.keywords?.keywords ?? fiche.keywords?.results ?? []).map((k) => k.name).slice(0, 12);

  const realisateurs =
    titre.type === 'film'
      ? (fiche.credits?.crew ?? []).filter((m) => m.job === 'Director').map((m) => m.name)
      : (fiche.created_by ?? []).map((m) => m.name);

  const acteurs = (fiche.credits?.cast ?? fiche.aggregate_credits?.cast ?? []).slice(0, 5).map((a) => a.name);

  const duree = titre.type === 'film' ? (fiche.runtime ?? null) : (fiche.episode_run_time?.[0] ?? null);

  const classification =
    titre.type === 'film'
      ? normaliserClassification(
          fiche.release_dates?.results
            ?.find((r) => r.iso_3166_1 === region)
            ?.release_dates?.find((d) => d.certification)?.certification,
        )
      : normaliserClassification(fiche.content_ratings?.results?.find((r) => r.iso_3166_1 === region)?.rating);

  const bandeAnnonce =
    (fiche.videos?.results ?? [])
      .filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
      .sort((a, b) => Number(b.official ?? false) - Number(a.official ?? false))[0]?.key ?? null;

  return {
    ...titre,
    genres,
    motsCles,
    realisateurs,
    acteurs,
    pays: fiche.production_countries?.map((p) => p.iso_3166_1) ?? fiche.origin_country ?? [],
    duree,
    saisons: fiche.number_of_seasons ?? null,
    classification,
    plateformes: plateformesDepuisFiche(fiche, region),
    tonalites: infererTonalites(genres, motsCles),
    rythme: infererRythme(genres, duree),
    bandeAnnonce,
    animation: genres.includes('Animation'),
  };
}

/** Extrait les plateformes CinéMood d'une réponse /watch/providers. */
function plateformesDepuisFiche(fiche: FicheDetaillee, region: string): string[] {
  const bloc = fiche['watch/providers']?.results?.[region];
  if (!bloc) return [];
  const tous = [...(bloc.flatrate ?? []), ...(bloc.free ?? []), ...(bloc.ads ?? [])];
  const ids = new Set<string>();
  for (const f of tous) {
    const cinemood = PLATEFORME_PAR_ID_TMDB[f.provider_id];
    if (cinemood) ids.add(cinemood);
  }
  return [...ids];
}

/** Enrichit une liste de titres, avec une concurrence bornée. */
export async function enrichirTous(titres: Titre[], concurrence = 6): Promise<Titre[]> {
  const resultat: Titre[] = [];
  for (let i = 0; i < titres.length; i += concurrence) {
    const lot = titres.slice(i, i + concurrence);
    resultat.push(...(await Promise.all(lot.map((t) => enrichirTitre(t)))));
  }
  return resultat;
}

/* ---------------------------------------------------------------------
   Recherche (écran « Découvrir »).
   --------------------------------------------------------------------- */

interface PageRecherche {
  results: Array<ResultatDecouverte & { media_type?: string }>;
}

export async function rechercherTmdb(requete: string): Promise<Titre[]> {
  if (requete.trim().length < 2) return [];
  try {
    const reponse = await tmdb<PageRecherche>(
      '/search/multi',
      { query: requete, include_adult: 'false', page: 1 },
      DUREES_CACHE.recherche,
    );
    return reponse.results
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r) => versTitreLeger(r, r.media_type === 'movie' ? 'film' : 'serie', '18'));
  } catch {
    return [];
  }
}
