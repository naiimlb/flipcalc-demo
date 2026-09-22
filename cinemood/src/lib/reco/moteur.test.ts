import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classerPourDecouverte, diagnostiquerFiltrage, filtrerStrict, recommander } from './moteur.ts';
import { PLATEFORMES_GRATUITES } from './plateformes.ts';
import { enregistrerExpositions, historiqueVide } from './profil.ts';
import { CATALOGUE_DEMO } from '../../data/catalogue-demo.ts';
import { contexte, historique, profil, titre } from './aide-tests.ts';

const ANNEE = 2026;

describe('filtrage strict — les règles non négociables', () => {
  test('ne propose JAMAIS un titre indisponible sur les plateformes de la personne', () => {
    const p = profil({ plateformes: ['netflix'] });
    const retenus = filtrerStrict(CATALOGUE_DEMO, p, historiqueVide(), contexte(), ANNEE);
    assert.ok(retenus.length > 0, 'le catalogue de démo doit contenir des titres Netflix');
    for (const t of retenus) {
      assert.ok(t.plateformes.includes('netflix'), `${t.titre} n’est pas sur Netflix`);
    }
  });

  test('le vivier TMDB, dont les plateformes ne sont pas encore connues, n’est pas vidé', () => {
    // Reproduit la passe 1 réelle : /discover a déjà filtré par
    // `with_watch_providers`, mais les plateformes de chaque titre
    // n'arrivent qu'à l'enrichissement. Les traiter comme « disponible
    // nulle part » éliminait 100 % du vivier, et l'accueil restait vide
    // pour tout le monde dès que TMDB était configuré.
    const vivier = [titre({ id: 'film:1', plateformes: [] }), titre({ id: 'film:2', plateformes: [] })];
    const p = profil({ plateformes: ['netflix'] });

    const sansDrapeau = filtrerStrict(vivier, p, historiqueVide(), contexte(), ANNEE);
    assert.equal(sansDrapeau.length, 0, 'sur un catalogue complet, « aucune plateforme » exclut bien');

    const avecDrapeau = filtrerStrict(vivier, p, historiqueVide(), contexte(), ANNEE, true);
    assert.equal(avecDrapeau.length, 2, 'le vivier TMDB doit traverser la passe 1 intact');
  });

  test('un titre du vivier réellement hors plateformes reste exclu, drapeau ou non', () => {
    // Le drapeau ne doit dispenser QUE les plateformes inconnues : une
    // liste renseignée mais sans correspondance reste une exclusion.
    const enrichi = [titre({ id: 'film:3', plateformes: ['disney'] })];
    const p = profil({ plateformes: ['netflix'] });

    assert.equal(filtrerStrict(enrichi, p, historiqueVide(), contexte(), ANNEE, true).length, 0);
  });

  test('le repli sauve un profil que ses préférences vident, sans céder sur l’essentiel', () => {
    // Des préférences qui, ensemble, n'épargnent rien : le repli doit
    // fournir quelque chose plutôt qu'un écran vide.
    const etouffe = profil({
      plateformes: ['netflix'],
      genresDetestes: [...new Set(CATALOGUE_DEMO.flatMap((t) => t.genres))],
      animationOk: false,
    });
    const strict = recommander(CATALOGUE_DEMO, etouffe, historiqueVide(), contexte(), { anneeCourante: ANNEE });
    assert.equal(strict.recommandations.length, 0, 'sans repli, ce profil ne laisse rien passer');

    const avecRepli = recommander(CATALOGUE_DEMO, etouffe, historiqueVide(), contexte(), {
      anneeCourante: ANNEE,
      replierSiVide: true,
    });
    assert.ok(avecRepli.recommandations.length > 0, 'le repli doit proposer quelque chose');
    assert.equal(avecRepli.preferencesRelachees, true, 'et le signaler, pour ne pas mentir');

    // Ce que le repli ne doit JAMAIS céder : plateformes et âge.
    for (const r of avecRepli.recommandations) {
      assert.ok(r.titre.plateformes.includes('netflix'), `${r.titre.titre} n’est pas sur Netflix`);
    }
  });

  test('le repli ne sert jamais du contenu au-dessus de l’âge de la personne', () => {
    const enfant = profil({
      anneeNaissance: ANNEE - 9,
      plateformes: [],
      genresDetestes: [...new Set(CATALOGUE_DEMO.flatMap((t) => t.genres))],
    });
    const avecRepli = recommander(CATALOGUE_DEMO, enfant, historiqueVide(), contexte(), {
      anneeCourante: ANNEE,
      replierSiVide: true,
    });
    assert.ok(
      avecRepli.recommandations.length > 0,
      'sans quoi la vérification suivante ne prouverait rien',
    );
    for (const r of avecRepli.recommandations) {
      assert.ok(
        ['TP', '10'].includes(r.titre.classification),
        `${r.titre.titre} (${r.titre.classification}) ne convient pas à un enfant de 9 ans`,
      );
    }
  });

  test('le diagnostic nomme la règle qui a écarté chaque titre', () => {
    const p = profil({ plateformes: ['netflix'], typesSouhaites: ['film'] });
    const exclusions = diagnostiquerFiltrage(
      [titre({ id: 'a', plateformes: ['disney'] }), titre({ id: 'b', plateformes: ['netflix'], type: 'serie' })],
      p, historiqueVide(), contexte(), ANNEE,
    );
    assert.equal(exclusions.plateformes, 1, 'le titre hors plateforme doit être imputé aux plateformes');
    assert.equal(exclusions.type, 1, 'la série doit être imputée au type souhaité');
  });

  test('« aucun abonnement » bascule sur les seules offres gratuites', () => {
    const p = profil({ plateformes: [] });
    const retenus = filtrerStrict(CATALOGUE_DEMO, p, historiqueVide(), contexte(), ANNEE);
    assert.ok(retenus.length > 0, 'il doit rester des titres gratuits à proposer');
    for (const t of retenus) {
      assert.ok(
        t.plateformes.some((x) => PLATEFORMES_GRATUITES.includes(x)),
        `${t.titre} n’est pas accessible gratuitement`,
      );
    }
  });

  test('aucun contenu -16 ou -18 pour un mineur', () => {
    // Né en 2012 : 14 ans en 2026.
    const ado = profil({ anneeNaissance: 2012, plateformes: ['netflix', 'max', 'prime', 'canal', 'disney'] });
    const retenus = filtrerStrict(CATALOGUE_DEMO, ado, historiqueVide(), contexte(), ANNEE);
    assert.ok(retenus.length > 0);
    for (const t of retenus) {
      assert.ok(['TP', '10', '12'].includes(t.classification), `${t.titre} (${t.classification}) interdit à 14 ans`);
    }
  });

  test('une soirée « en famille » plafonne la classification, même pour un adulte', () => {
    const adulte = profil({ anneeNaissance: 1985, plateformes: ['netflix', 'max', 'prime', 'disney', 'canal'] });
    const retenus = filtrerStrict(CATALOGUE_DEMO, adulte, historiqueVide(), contexte({ compagnie: 'famille' }), ANNEE);
    assert.ok(retenus.length > 0);
    for (const t of retenus) {
      assert.ok(['TP', '10'].includes(t.classification), `${t.titre} n’est pas une séance familiale`);
    }
  });

  test('respecte le choix films / séries', () => {
    const seriesSeulement = profil({ typesSouhaites: ['serie'], plateformes: ['netflix', 'max', 'prime'] });
    const retenus = filtrerStrict(CATALOGUE_DEMO, seriesSeulement, historiqueVide(), contexte(), ANNEE);
    assert.ok(retenus.length > 0);
    assert.ok(retenus.every((t) => t.type === 'serie'));
  });

  test('écarte l’animation quand elle a été refusée au test', () => {
    const p = profil({ animationOk: false, plateformes: ['netflix', 'disney', 'crunchyroll'] });
    const retenus = filtrerStrict(CATALOGUE_DEMO, p, historiqueVide(), contexte(), ANNEE);
    assert.ok(retenus.every((t) => !t.animation));
  });
});

describe('sélection complète', () => {
  const p = profil({
    anneeNaissance: 1990,
    plateformes: ['netflix', 'max', 'prime'],
    gouts: {
      genres: { 'Science-Fiction': 0.8, Drame: 0.4, Horreur: -0.7 },
      motsCles: {},
      realisateurs: {},
      acteurs: {},
      pays: {},
      decennies: {},
      tonalites: { intense: 0.6 },
    },
  });

  test('rend le nombre de titres demandé', () => {
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { taille: 15, anneeCourante: ANNEE });
    assert.equal(r.recommandations.length, 15);
  });

  test('aucun doublon dans la sélection', () => {
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { taille: 18, anneeCourante: ANNEE });
    const ids = r.recommandations.map((x) => x.titre.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('chaque carte porte une phrase « Pourquoi pour toi »', () => {
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte({ humeur: 'adrenaline' }), {
      taille: 12,
      anneeCourante: ANNEE,
    });
    for (const reco of r.recommandations) {
      assert.ok(reco.pourquoi.length > 20, `explication trop courte : « ${reco.pourquoi} »`);
      assert.ok(reco.pourquoi.trim().endsWith('.'), 'la phrase doit être ponctuée');
    }
  });

  test('la sélection est diversifiée', () => {
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { taille: 15, anneeCourante: ANNEE });
    const genres = new Set(r.recommandations.map((x) => x.titre.genres[0]));
    assert.ok(genres.size >= 5, `seulement ${genres.size} genres principaux différents`);
  });

  test('laisse une vraie place à la découverte', () => {
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { taille: 15, anneeCourante: ANNEE });
    // Le badge « Pépite » ne marque que les titres injectés volontairement :
    // il reste donc minoritaire, par construction.
    const badgees = r.recommandations.filter((x) => x.pepite).length;
    assert.ok(badgees <= 4, `trop de titres badgés « pépite » : ${badgees}/15`);

    // Exigence du cahier des charges : 15 à 20 % de la sélection doit
    // sortir de la zone de confort — badgé ou remonté naturellement.
    const peuExposes = r.recommandations.filter((x) => x.titre.popularite <= 30).length;
    assert.ok(peuExposes >= 2, `seulement ${peuExposes}/15 titres hors des sentiers battus`);
  });

  test('rotation : les titres déjà proposés cette semaine cèdent la place', () => {
    const premiere = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), {
      taille: 12,
      anneeCourante: ANNEE,
    });
    const idsPremiere = premiere.recommandations.map((x) => x.titre.id);
    const h = enregistrerExpositions(historiqueVide(), idsPremiere, contexte().maintenant);

    const seconde = recommander(CATALOGUE_DEMO, p, h, contexte(), { taille: 12, anneeCourante: ANNEE });
    const idsSeconde = seconde.recommandations.map((x) => x.titre.id);
    const communs = idsSeconde.filter((id) => idsPremiere.includes(id)).length;
    assert.ok(communs <= 4, `${communs}/12 titres reproposés immédiatement : la rotation ne joue pas`);
  });

  test('les titres refusés ne reviennent pas', () => {
    const premiere = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), {
      taille: 10,
      anneeCourante: ANNEE,
    });
    const refuses = premiere.recommandations.slice(0, 5).map((x) => x.titre.id);
    const seconde = recommander(CATALOGUE_DEMO, p, historique({ refuses }), contexte(), {
      taille: 10,
      anneeCourante: ANNEE,
    });
    for (const reco of seconde.recommandations) {
      assert.ok(!refuses.includes(reco.titre.id), `${reco.titre.titre} a été refusé et revient`);
    }
  });

  test('l’humeur change réellement la sélection', () => {
    const rire = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte({ humeur: 'rire' }), {
      taille: 12,
      anneeCourante: ANNEE,
    });
    const frisson = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte({ humeur: 'frisson' }), {
      taille: 12,
      anneeCourante: ANNEE,
    });
    const idsRire = new Set(rire.recommandations.map((x) => x.titre.id));
    const communs = frisson.recommandations.filter((x) => idsRire.has(x.titre.id)).length;
    assert.ok(communs <= 5, `« envie de rire » et « envie de frissonner » partagent ${communs}/12 titres`);

    const comediesRire = rire.recommandations.filter((x) => x.titre.genres.includes('Comédie')).length;
    const comediesFrisson = frisson.recommandations.filter((x) => x.titre.genres.includes('Comédie')).length;
    assert.ok(comediesRire > comediesFrisson, 'l’humeur « rire » doit remonter les comédies');
  });

  test('deux profils différents reçoivent des sélections différentes', () => {
    const cinephile = profil({
      anneeNaissance: 1975,
      plateformes: ['canal', 'arte'],
      gouts: {
        genres: { Drame: 0.9, 'Science-Fiction': -0.3 },
        motsCles: {},
        realisateurs: {},
        acteurs: {},
        pays: { FR: 0.7 },
        decennies: {},
        tonalites: { reflechi: 0.8 },
      },
    });
    const ado = profil({
      anneeNaissance: 2010,
      plateformes: ['netflix', 'crunchyroll'],
      gouts: {
        genres: { Animation: 0.9, Action: 0.7, Drame: -0.2 },
        motsCles: {},
        realisateurs: {},
        acteurs: {},
        pays: { JP: 0.8 },
        decennies: {},
        tonalites: { intense: 0.7 },
      },
    });

    const a = recommander(CATALOGUE_DEMO, cinephile, historiqueVide(), contexte(), { taille: 10, anneeCourante: ANNEE });
    const b = recommander(CATALOGUE_DEMO, ado, historiqueVide(), contexte(), { taille: 10, anneeCourante: ANNEE });
    const idsA = new Set(a.recommandations.map((x) => x.titre.id));
    const communs = b.recommandations.filter((x) => idsA.has(x.titre.id)).length;
    assert.equal(communs, 0, 'deux profils opposés ne devraient rien avoir en commun ici');
  });

  test('les meilleurs titres restent en tête de liste', () => {
    // Le MMR réordonne volontairement : la liste n'est donc PAS
    // strictement décroissante. Ce qu'on garantit, c'est que la première
    // moitié pèse plus lourd que la seconde.
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { taille: 12, anneeCourante: ANNEE });
    const scores = r.recommandations.map((x) => x.score);
    const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(
      moyenne(scores.slice(0, 6)) > moyenne(scores.slice(6)),
      'la première moitié de la liste doit être la plus pertinente',
    );
    assert.equal(scores[0], Math.max(...scores), 'le meilleur titre doit ouvrir la liste');
  });
});

describe('états vides', () => {
  test('catalogue vide', () => {
    const r = recommander([], profil(), historiqueVide(), contexte(), { anneeCourante: ANNEE });
    assert.equal(r.raisonVide, 'catalogue_vide');
    assert.equal(r.recommandations.length, 0);
  });

  test('plateforme sans aucun titre disponible', () => {
    const p = profil({ plateformes: ['plateforme-inconnue'] });
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { anneeCourante: ANNEE });
    assert.equal(r.recommandations.length, 0);
    assert.equal(r.raisonVide, 'filtres_trop_stricts');
  });

  test('une personne sans abonnement obtient quand même des titres', () => {
    const p = profil({ plateformes: [] });
    const r = recommander(CATALOGUE_DEMO, p, historiqueVide(), contexte(), { taille: 10, anneeCourante: ANNEE });
    assert.ok(r.recommandations.length >= 8, `seulement ${r.recommandations.length} titres gratuits proposés`);
    assert.equal(r.raisonVide, null);
  });
});

describe('écran Découvrir', () => {
  test('classe tous les titres éligibles sans injecter de pépites', () => {
    const p = profil({ plateformes: ['netflix'] });
    const liste = classerPourDecouverte(CATALOGUE_DEMO, p, historiqueVide(), contexte(), ANNEE);
    assert.ok(liste.length > 20);
    assert.ok(liste.every((x) => !x.pepite));
    for (let i = 1; i < liste.length; i += 1) {
      assert.ok(liste[i].score <= liste[i - 1].score + 1e-9);
    }
  });
});

test('un titre hors plateforme n’entre jamais dans la sélection, même parfait par ailleurs', () => {
  // Titre idéal sur tous les critères… mais sur une plateforme non possédée.
  const parfaitMaisIndisponible = titre({
    titre: 'Le Film Parfait Inaccessible',
    genres: ['Science-Fiction'],
    note: 9.8,
    nbVotes: 500000,
    popularite: 100,
    annee: 2025,
    plateformes: ['appletv'],
  });
  const p = profil({ plateformes: ['netflix'] });
  const r = recommander([...CATALOGUE_DEMO, parfaitMaisIndisponible], p, historiqueVide(), contexte(), {
    taille: 20,
    anneeCourante: ANNEE,
  });
  assert.ok(!r.recommandations.some((x) => x.titre.id === parfaitMaisIndisponible.id));
});
