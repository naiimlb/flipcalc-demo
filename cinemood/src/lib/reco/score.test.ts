import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { affiniteGouts, calculerPenalites, scoreFraicheur, scoreQualite, scorerTitre } from './score.ts';
import { construireProfilDepuisTest, vecteurVide } from './profil.ts';
import { FENETRE_ROTATION_MS } from './poids.ts';
import { contexte, historique, profil, titre } from './aide-tests.ts';

describe('qualité', () => {
  test('amortit une note flatteuse obtenue sur peu de votes', () => {
    const pepiteDouteuse = titre({ note: 9.5, nbVotes: 12 });
    const valeurSure = titre({ note: 8.2, nbVotes: 30000 });
    assert.ok(
      scoreQualite(valeurSure) > scoreQualite(pepiteDouteuse),
      'un 8,2/10 sur 30 000 votes doit battre un 9,5/10 sur 12 votes',
    );
  });

  test('reste dans [0, 1]', () => {
    assert.ok(scoreQualite(titre({ note: 0, nbVotes: 0 })) >= 0);
    assert.ok(scoreQualite(titre({ note: 10, nbVotes: 999999 })) <= 1);
  });
});

describe('fraîcheur', () => {
  test('décroît avec l’ancienneté à popularité égale', () => {
    const neuf = titre({ annee: 2025, popularite: 40 });
    const vieux = titre({ annee: 1995, popularite: 40 });
    assert.ok(scoreFraicheur(neuf, 2026) > scoreFraicheur(vieux, 2026));
  });

  test('la popularité rattrape partiellement un titre ancien', () => {
    const ancienPopulaire = titre({ annee: 1994, popularite: 95 });
    const ancienOublie = titre({ annee: 1994, popularite: 5 });
    assert.ok(scoreFraicheur(ancienPopulaire, 2026) > scoreFraicheur(ancienOublie, 2026));
  });
});

describe('affinité de goûts', () => {
  test('un genre adoré fait monter le score, un genre détesté le fait chuter', () => {
    const p = profil({
      gouts: { ...vecteurVide(), genres: { 'Science-Fiction': 0.9, Horreur: -0.9 } },
    });
    const sf = affiniteGouts(titre({ genres: ['Science-Fiction'] }), p).score;
    const horreur = affiniteGouts(titre({ genres: ['Horreur'] }), p).score;
    const inconnu = affiniteGouts(titre({ genres: ['Western'] }), p).score;
    assert.ok(sf > inconnu, 'le genre adoré doit dépasser un genre neutre');
    assert.ok(horreur < inconnu, 'le genre détesté doit passer sous un genre neutre');
  });

  test('ne pénalise pas un titre dont le casting est inconnu du profil', () => {
    const p = profil({ gouts: { ...vecteurVide(), genres: { Drame: 0.8 } } });
    const avecCasting = affiniteGouts(titre({ genres: ['Drame'], acteurs: ['Inconnu·e'] }), p).score;
    const sansCasting = affiniteGouts(titre({ genres: ['Drame'] }), p).score;
    assert.ok(Math.abs(avecCasting - sansCasting) < 0.001, 'une facette muette doit être ignorée');
  });

  test('remonte les contributions dominantes pour l’explication', () => {
    const p = profil({
      gouts: { ...vecteurVide(), realisateurs: { 'Denis Villeneuve': 0.95 }, genres: { Drame: 0.1 } },
    });
    const { contributions } = affiniteGouts(
      titre({ genres: ['Drame'], realisateurs: ['Denis Villeneuve'] }),
      p,
    );
    assert.equal(contributions[0].facette, 'realisateurs');
    assert.equal(contributions[0].libelle, 'Denis Villeneuve');
  });

  test('profil vierge : score neutre, ni bonus ni malus', () => {
    const score = affiniteGouts(titre(), profil()).score;
    assert.ok(score > 0.45 && score < 0.55, `attendu ~0,5 — reçu ${score}`);
  });
});

describe('pénalités', () => {
  const p = profil({ genresDetestes: ['Horreur'] });
  const ctx = contexte();

  test('un titre refusé est écarté de fait', () => {
    const t = titre();
    const penalite = calculerPenalites(t, p, historique({ refuses: [t.id] }), ctx);
    assert.ok(penalite >= 1, 'un refus explicite doit être éliminatoire');
  });

  test('un genre détesté coûte cher', () => {
    const sans = calculerPenalites(titre({ genres: ['Drame'] }), p, historique(), ctx);
    const avec = calculerPenalites(titre({ genres: ['Horreur'] }), p, historique(), ctx);
    assert.ok(avec > sans + 0.4);
  });

  test('la sur-exposition est pénalisée mais plafonnée', () => {
    const t = titre();
    const trois = calculerPenalites(t, p, historique({ expositions: { [t.id]: 3 } }), ctx);
    const trente = calculerPenalites(t, p, historique({ expositions: { [t.id]: 30 } }), ctx);
    assert.ok(trois > 0);
    assert.ok(trente < 0.4, 'le plafond doit empêcher une pénalité qui explose');
  });

  test('rotation : un titre proposé cette semaine est mis de côté', () => {
    const t = titre();
    const recent = historique({ derniereProposition: { [t.id]: ctx.maintenant - 1000 } });
    const ancien = historique({
      derniereProposition: { [t.id]: ctx.maintenant - FENETRE_ROTATION_MS - 1000 },
    });
    assert.ok(calculerPenalites(t, p, recent, ctx) > calculerPenalites(t, p, ancien, ctx));
  });

  test('la durée maximale déclarée est respectée', () => {
    const court = titre({ duree: 90 });
    const fleuve = titre({ duree: 210 });
    const exigeant = profil({ dureeMax: 100 });
    assert.equal(calculerPenalites(court, exigeant, historique(), ctx), 0);
    assert.ok(calculerPenalites(fleuve, exigeant, historique(), ctx) > 0.7);
  });

  test('les sujets « à éviter » sont éliminatoires', () => {
    const sensible = profil({ aEviter: ['suicide'] });
    const t = titre({ motsCles: ['deuil', 'suicide'] });
    assert.ok(calculerPenalites(t, sensible, historique(), ctx) >= 1);
  });
});

describe('score final', () => {
  test('combine les cinq composantes et le détail est cohérent', () => {
    const p = construireProfilDepuisTest({
      pseudo: 'Léa',
      anneeNaissance: 1992,
      typesSouhaites: ['film'],
      genresAdores: ['Science-Fiction'],
      genresDetestes: ['Horreur'],
      favoris: [],
      enfance: [],
      tonalitePreferee: 'reflechi',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix'],
      pays: 'FR',
    });

    const bon = scorerTitre(
      titre({ genres: ['Science-Fiction'], annee: 2008, note: 8.4, nbVotes: 20000, tonalites: ['reflechi'] }),
      p,
      historique(),
      contexte({ humeur: 'reflexion' }),
      2026,
    );
    const mauvais = scorerTitre(
      titre({ genres: ['Horreur'], annee: 1968, note: 5.1, nbVotes: 300, tonalites: ['flippant'] }),
      p,
      historique(),
      contexte({ humeur: 'reflexion' }),
      2026,
    );

    assert.ok(bon.score > mauvais.score);
    for (const cle of ['gouts', 'epoque', 'humeur', 'qualite', 'fraicheur'] as const) {
      assert.ok(bon.detail[cle] >= 0 && bon.detail[cle] <= 1, `${cle} hors bornes`);
    }
    assert.equal(bon.detail.penalites, 0);
    assert.ok(mauvais.detail.penalites > 0, 'le genre détesté doit produire une pénalité');
  });
});
