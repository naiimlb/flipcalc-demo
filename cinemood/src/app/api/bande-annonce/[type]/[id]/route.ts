/* =====================================================================
   /api/bande-annonce/[type]/[id] — Identifiant YouTube d'une bande-annonce.
   ---------------------------------------------------------------------
   Appelée au moment où l'on appuie sur « ▶ Bande-annonce », quand le
   titre n'a pas déjà sa clé vidéo. On privilégie les vidéos françaises,
   puis les officielles, puis n'importe quelle bande-annonce.
   ===================================================================== */

import { NextResponse } from 'next/server';

import { DUREES_CACHE, modeDemo, tmdb } from '@/lib/tmdb/client';

interface Video {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  iso_639_1?: string;
}

export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await contexte.params;
  const tmdbId = Number(id);

  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || (type !== 'film' && type !== 'serie')) {
    return NextResponse.json({ erreur: 'Titre inconnu.' }, { status: 400 });
  }
  if (modeDemo()) {
    // Sans jeton TMDB, on n'a pas les clés vidéo : le client bascule sur
    // une recherche YouTube, ce qui reste utilisable.
    return NextResponse.json({ cle: null, modeDemo: true });
  }

  try {
    const chemin = type === 'film' ? `/movie/${tmdbId}/videos` : `/tv/${tmdbId}/videos`;
    const reponse = await tmdb<{ results: Video[] }>(chemin, {}, DUREES_CACHE.fiche);
    const youtube = reponse.results.filter((v) => v.site === 'YouTube');

    const choisie =
      youtube.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'fr' && v.official) ??
      youtube.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'fr') ??
      youtube.find((v) => v.type === 'Trailer' && v.official) ??
      youtube.find((v) => v.type === 'Trailer') ??
      youtube.find((v) => v.type === 'Teaser') ??
      null;

    return NextResponse.json({ cle: choisie?.key ?? null, modeDemo: false });
  } catch (erreur) {
    console.error('[bande-annonce]', erreur);
    return NextResponse.json({ cle: null, erreur: 'Bande-annonce indisponible.' }, { status: 502 });
  }
}
