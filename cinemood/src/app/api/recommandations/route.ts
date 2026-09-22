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
    if (!modeDemo()) {
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

      // Une sélection en deux passes, et un repli si l'humeur étrangle
      // le vivier : quelqu'un qui a passé le test doit TOUJOURS repartir
      // avec des propositions. Seule l'humeur est relâchée — les règles
      // dures (plateformes, âge, genres détestés) restent intactes.
      const construire = async (genres: number[]) => {
        const vivier = await vivierTmdb({
          plateformes: profil.plateformes,
          typesSouhaites: profil.typesSouhaites,
          classificationMax,
          genresPrioritaires: genres,
          pages: 3,
        });

        // Passe 1 : le vivier ne porte pas encore ses plateformes, elles
        // n'arrivent qu'à l'enrichissement. TMDB les a déjà filtrées via
        // `with_watch_providers`, d'où le drapeau — sans lui, le filtre
        // strict viderait tout le vivier ici même.
        const tri = recommander(vivier.titres, profil, historique, contexte, {
          taille: Math.min(20, taille + 8),
          anneeCourante,
          plateformesDejaFiltrees: true,
          replierSiVide: true,
        });

        // Passe 2 : seuls les présélectionnés sont détaillés — une
        // vingtaine d'appels TMDB au lieu de plusieurs centaines. Cette
        // fois les plateformes sont connues, donc filtrées pour de bon.
        const enrichis = await enrichirTous(tri.recommandations.map((r) => r.titre));
        const abouti = recommander(enrichis, profil, historique, contexte, {
          taille,
          anneeCourante,
          replierSiVide: true,
        });
        return { vivier, tri, abouti };
      };

      let { vivier, tri, abouti } = await construire(genresHumeur);
      let humeurRelachee = false;

      if (abouti.recommandations.length === 0 && genresHumeur.length > 0) {
        ({ vivier, tri, abouti } = await construire([]));
        humeurRelachee = abouti.recommandations.length > 0;
      }

      // Un vivier vide parce que TMDB n'a pas répondu n'est PAS un
      // problème de critères : le dire franchement plutôt que d'envoyer
      // la personne desserrer des filtres qui n'y sont pour rien.
      const tmdbInjoignable = vivier.titres.length === 0 && vivier.pagesEnEchec > 0;
      if (tmdbInjoignable) {
        console.error(
          '[recommandations] vivier vide,',
          `${vivier.pagesEnEchec}/${vivier.pagesDemandees} appels TMDB en échec :`,
          vivier.premiereErreur,
        );
      }

      return NextResponse.json({
        recommandations: abouti.recommandations,
        candidatsRetenus: tri.candidatsRetenus,
        catalogueTotal: tri.catalogueTotal,
        raisonVide: tmdbInjoignable ? 'tmdb_injoignable' : abouti.raisonVide,
        humeurRelachee,
        preferencesRelachees: abouti.preferencesRelachees,
        diagnostic: {
          vivier: vivier.titres.length,
          pagesEnEchec: vivier.pagesEnEchec,
          pagesDemandees: vivier.pagesDemandees,
          erreurTmdb: vivier.premiereErreur,
          exclusions: abouti.exclusions ?? tri.exclusions,
        },
        modeDemo: false,
      });
    }

    // --- Mode démo : catalogue local, une seule passe -------------------
    // Ses titres portent déjà leurs plateformes : aucun enrichissement.
    const premierTri = recommander(CATALOGUE_DEMO, profil, historique, contexte, {
      taille,
      anneeCourante,
      replierSiVide: true,
    });

    return NextResponse.json({
      recommandations: premierTri.recommandations,
      candidatsRetenus: premierTri.candidatsRetenus,
      catalogueTotal: premierTri.catalogueTotal,
      raisonVide: premierTri.raisonVide,
      humeurRelachee: false,
      preferencesRelachees: premierTri.preferencesRelachees,
      diagnostic: {
        vivier: CATALOGUE_DEMO.length,
        pagesEnEchec: 0,
        pagesDemandees: 0,
        erreurTmdb: null,
        exclusions: premierTri.exclusions,
      },
      modeDemo: true,
    });
  } catch (erreur) {
    console.error('[recommandations]', erreur);
    return NextResponse.json(
      { erreur: 'Impossible de construire une sélection pour le moment.' },
      { status: 502 },
    );
  }
}
