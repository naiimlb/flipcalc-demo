/* =====================================================================
   /api/recommandations — Le moteur tourne ici, côté serveur.
   ---------------------------------------------------------------------
   Pourquoi côté serveur : c'est la seule façon de garder le jeton TMDB
   hors du navigateur. Le client envoie son profil et son contexte, et
   reçoit une sélection prête à afficher.

   En mode démo (pas de jeton TMDB), le vivier est le catalogue local :
   l'app est utilisable et démontrable avant toute configuration.
   ===================================================================== */

import { NextResponse } from 'next/server';

import { CATALOGUE_DEMO } from '@/data/catalogue-demo';
import { classificationMaximale, age as calculerAge } from '@/lib/reco/epoque';
import { recommander } from '@/lib/reco/moteur';
import { TABLE_COMPAGNIE, TABLE_HUMEURS } from '@/lib/reco/poids';
import { enrichirTous, vivierTmdb } from '@/lib/tmdb/catalogue';
import { modeDemo } from '@/lib/tmdb/client';
import { idDepuisGenre } from '@/lib/tmdb/genres';
import { contexteValide, historiqueValide, profilValide } from '@/lib/validation';
import type { Titre } from '@/lib/reco/types';

/** Le rendu dépend du corps de la requête : jamais de page statique. */
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
  const taille = Math.max(5, Math.min(20, Number(donnees.taille) || 15));
  const anneeCourante = new Date().getFullYear();

  try {
    let catalogue: Titre[];
    let enrichissementNecessaire = false;

    if (modeDemo()) {
      catalogue = CATALOGUE_DEMO;
    } else {
      // Plafond d'âge : le plus strict entre l'âge réel et la compagnie.
      const ageUtilisateur = calculerAge(profil.anneeNaissance, anneeCourante);
      const plafondCompagnie = TABLE_COMPAGNIE[contexte.compagnie]?.classificationMax ?? null;
      const classificationMax = classificationMaximale(ageUtilisateur, plafondCompagnie);

      // L'humeur oriente la découverte dès l'appel à TMDB : on ramène en
      // priorité les genres qui collent, sans s'y enfermer (les pages
      // suivantes restent généralistes).
      const genresHumeur = contexte.humeur
        ? TABLE_HUMEURS[contexte.humeur].genres
            .flatMap((nom) => profil.typesSouhaites.map((t) => idDepuisGenre(nom, t)))
            .filter((x): x is number => x !== null)
        : [];

      catalogue = await vivierTmdb({
        plateformes: profil.plateformes,
        typesSouhaites: profil.typesSouhaites,
        classificationMax,
        genresPrioritaires: genresHumeur,
        pages: 3,
      });
      enrichissementNecessaire = true;
    }

    // --- Première passe : classement sur le vivier ---------------------
    const premierTri = recommander(catalogue, profil, historique, contexte, {
      taille: enrichissementNecessaire ? Math.min(20, taille + 8) : taille,
      anneeCourante,
    });

    if (!enrichissementNecessaire) {
      return NextResponse.json({
        recommandations: premierTri.recommandations,
        candidatsRetenus: premierTri.candidatsRetenus,
        catalogueTotal: premierTri.catalogueTotal,
        raisonVide: premierTri.raisonVide,
        modeDemo: true,
      });
    }

    // --- Seconde passe : on détaille, puis on reclasse -----------------
    // Seuls les titres présélectionnés sont détaillés : une vingtaine
    // d'appels TMDB au lieu de plusieurs centaines.
    const enrichis = await enrichirTous(premierTri.recommandations.map((r) => r.titre));
    const final = recommander(enrichis, profil, historique, contexte, { taille, anneeCourante });

    return NextResponse.json({
      recommandations: final.recommandations,
      candidatsRetenus: premierTri.candidatsRetenus,
      catalogueTotal: premierTri.catalogueTotal,
      raisonVide: final.raisonVide,
      modeDemo: false,
    });
  } catch (erreur) {
    console.error('[recommandations]', erreur);
    return NextResponse.json(
      { erreur: 'Impossible de construire une sélection pour le moment.' },
      { status: 502 },
    );
  }
}
