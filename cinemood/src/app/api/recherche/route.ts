/* =====================================================================
   /api/recherche — Recherche et filtres de l'écran « Découvrir ».
   ---------------------------------------------------------------------
   Le classement reste personnalisé : même en recherche, on remonte
   d'abord ce qui correspond au profil, et on n'affiche jamais un titre
   indisponible sur les plateformes de la personne.
   ===================================================================== */

import { NextResponse } from 'next/server';

import { CATALOGUE_DEMO } from '@/data/catalogue-demo';
import { classerPourDecouverte } from '@/lib/reco/moteur';
import { enrichirTous, rechercherTmdb, vivierTmdb } from '@/lib/tmdb/catalogue';
import { modeDemo } from '@/lib/tmdb/client';
import { classificationMaximale, age as calculerAge } from '@/lib/reco/epoque';
import { contexteValide, profilValide, historiqueValide } from '@/lib/validation';
import type { Titre } from '@/lib/reco/types';

export const dynamic = 'force-dynamic';

export async function POST(requete: Request) {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête illisible.' }, { status: 400 });
  }

  const donnees = (corps ?? {}) as Record<string, unknown>;
  const profil = profilValide(donnees.profil);
  const historique = historiqueValide(donnees.historique);
  const contexte = contexteValide(donnees.contexte);
  const requeteTexte = typeof donnees.q === 'string' ? donnees.q.slice(0, 80) : '';
  const filtres = (donnees.filtres ?? {}) as {
    genre?: string;
    plateforme?: string;
    dureeMax?: number;
    decennie?: number;
  };
  const anneeCourante = new Date().getFullYear();

  try {
    let catalogue: Titre[];

    if (modeDemo()) {
      catalogue = CATALOGUE_DEMO;
    } else if (requeteTexte.trim().length >= 2) {
      // Recherche : TMDB ne filtre pas par plateforme, on enrichit donc
      // pour connaître les disponibilités réelles avant de trier.
      catalogue = await enrichirTous((await rechercherTmdb(requeteTexte)).slice(0, 20));
    } else {
      const ageUtilisateur = calculerAge(profil.anneeNaissance, anneeCourante);
      catalogue = await vivierTmdb({
        plateformes: profil.plateformes,
        typesSouhaites: profil.typesSouhaites,
        classificationMax: classificationMaximale(ageUtilisateur, null),
        pages: 2,
      });
    }

    // --- Recherche textuelle sur le catalogue local --------------------
    if (requeteTexte.trim().length >= 2 && modeDemo()) {
      const aiguille = sansAccents(requeteTexte);
      catalogue = catalogue.filter(
        (t) =>
          sansAccents(t.titre).includes(aiguille) ||
          t.realisateurs.some((r) => sansAccents(r).includes(aiguille)) ||
          t.acteurs.some((a) => sansAccents(a).includes(aiguille)),
      );
    }

    // --- Filtres de l'interface ---------------------------------------
    if (filtres.genre) catalogue = catalogue.filter((t) => t.genres.includes(filtres.genre as string));
    if (filtres.plateforme) catalogue = catalogue.filter((t) => t.plateformes.includes(filtres.plateforme as string));
    if (filtres.dureeMax) {
      catalogue = catalogue.filter((t) => (t.duree ?? 45) <= (filtres.dureeMax as number));
    }
    if (filtres.decennie) {
      const d = filtres.decennie;
      catalogue = catalogue.filter((t) => t.annee >= d && t.annee < d + 10);
    }

    const resultats = classerPourDecouverte(catalogue, profil, historique, contexte, anneeCourante).slice(0, 40);
    return NextResponse.json({ resultats, modeDemo: modeDemo() });
  } catch (erreur) {
    console.error('[recherche]', erreur);
    return NextResponse.json({ erreur: 'La recherche a échoué.' }, { status: 502 });
  }
}

/** Comparaison insensible aux accents et à la casse. */
function sansAccents(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
