import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estPepite, genrePrincipal, injecterPepites, jaccard, reclasserMMR, similariteTitres } from './diversite.ts';
import type { Candidat } from './diversite.ts';
import { DIVERSITE } from './poids.ts';
import { titre } from './aide-tests.ts';

const candidat = (t: ReturnType<typeof titre>, score: number, affinite = 0.6): Candidat => ({
  titre: t,
  score,
  affinite,
});

describe('similarité', () => {
  test('jaccard', () => {
    assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
    assert.equal(jaccard(['a'], ['b']), 0);
    assert.equal(jaccard(['a', 'b'], ['b', 'c']), 1 / 3);
  });

  test('deux films du même genre et du même réalisateur sont proches', () => {
    const a = titre({ genres: ['Science-Fiction'], realisateurs: ['X'], motsCles: ['espace'], annee: 2014 });
    const b = titre({ genres: ['Science-Fiction'], realisateurs: ['X'], motsCles: ['espace'], annee: 2017 });
    const c = titre({ genres: ['Comédie'], realisateurs: ['Y'], motsCles: ['mariage'], annee: 1994 });
    assert.ok(similariteTitres(a, b) > similariteTitres(a, c));
  });

  test('deux volets d’une même franchise sont détectés', () => {
    const a = titre({ titre: 'Dune', genres: ['Science-Fiction'] });
    const b = titre({ titre: 'Dune : Deuxième Partie', genres: ['Science-Fiction'] });
    assert.ok(similariteTitres(a, b) > 0.6, 'la même franchise doit être très similaire');
  });

  test('genre principal = premier genre listé', () => {
    assert.equal(genrePrincipal(titre({ genres: ['Thriller', 'Drame'] })), 'Thriller');
    assert.equal(genrePrincipal(titre({ genres: [] })), 'Autre');
  });
});

describe('re-classement MMR', () => {
  test('n’enchaîne pas dix titres identiques', () => {
    // 10 thrillers quasi identiques, très bien notés, + 3 films variés
    // légèrement moins bien notés : la sélection doit s’ouvrir.
    const clones = Array.from({ length: 10 }, (_, i) =>
      candidat(
        titre({ genres: ['Thriller'], motsCles: ['enquête'], realisateurs: [`Real${i}`], annee: 2015 }),
        0.9 - i * 0.001,
      ),
    );
    const varies = [
      candidat(titre({ genres: ['Comédie'], motsCles: ['mariage'], realisateurs: ['A'] }), 0.7),
      candidat(titre({ genres: ['Animation'], motsCles: ['enfance'], realisateurs: ['B'] }), 0.68),
      candidat(titre({ genres: ['Documentaire'], motsCles: ['nature'], realisateurs: ['C'] }), 0.66),
    ];

    const selection = reclasserMMR([...clones, ...varies], 6);
    const genres = new Set(selection.map((c) => genrePrincipal(c.titre)));
    assert.ok(genres.size >= 3, `attendu au moins 3 genres différents, reçu ${[...genres].join(', ')}`);
  });

  test('respecte le quota par genre principal', () => {
    const beaucoup = Array.from({ length: 12 }, (_, i) =>
      candidat(titre({ genres: ['Thriller'], realisateurs: [`R${i}`] }), 0.9 - i * 0.01),
    );
    const autres = Array.from({ length: 12 }, (_, i) =>
      candidat(titre({ genres: ['Comédie'], realisateurs: [`C${i}`] }), 0.5 - i * 0.01),
    );
    const selection = reclasserMMR([...beaucoup, ...autres], 6);
    const thrillers = selection.filter((c) => genrePrincipal(c.titre) === 'Thriller').length;
    assert.ok(thrillers <= DIVERSITE.maxParGenrePrincipal, `${thrillers} thrillers sélectionnés`);
  });

  test('un seul titre par réalisateur', () => {
    const memeReal = Array.from({ length: 5 }, (_, i) =>
      candidat(titre({ genres: [`G${i}`], realisateurs: ['Auteur unique'] }), 0.9 - i * 0.01),
    );
    const autres = Array.from({ length: 5 }, (_, i) =>
      candidat(titre({ genres: [`H${i}`], realisateurs: [`Autre${i}`] }), 0.4),
    );
    const selection = reclasserMMR([...memeReal, ...autres], 5);
    const duReal = selection.filter((c) => c.titre.realisateurs.includes('Auteur unique')).length;
    assert.equal(duReal, 1);
  });

  test('rend toujours la taille demandée si le vivier suffit', () => {
    const vivier = Array.from({ length: 40 }, (_, i) =>
      candidat(titre({ genres: [`G${i % 7}`], realisateurs: [`R${i}`] }), Math.random()),
    );
    assert.equal(reclasserMMR(vivier, 12).length, 12);
  });

  test('ne renvoie jamais deux fois le même titre', () => {
    const vivier = Array.from({ length: 20 }, (_, i) =>
      candidat(titre({ genres: [`G${i % 4}`], realisateurs: [`R${i}`] }), 1 - i / 20),
    );
    const selection = reclasserMMR(vivier, 10);
    assert.equal(new Set(selection.map((c) => c.titre.id)).size, selection.length);
  });

  test('λ = 1 revient à un tri par pertinence pure', () => {
    const vivier = [
      candidat(titre({ genres: ['A'], realisateurs: ['1'] }), 0.3),
      candidat(titre({ genres: ['B'], realisateurs: ['2'] }), 0.9),
      candidat(titre({ genres: ['C'], realisateurs: ['3'] }), 0.6),
    ];
    const selection = reclasserMMR(vivier, 3, 1);
    assert.deepEqual(
      selection.map((c) => c.score),
      [0.9, 0.6, 0.3],
    );
  });
});

describe('pépites', () => {
  test('un titre peu populaire mais compatible est une pépite', () => {
    assert.equal(estPepite(candidat(titre({ popularite: 12 }), 0.5, 0.7)), true);
    // Trop populaire : ce n’est plus une découverte.
    assert.equal(estPepite(candidat(titre({ popularite: 90 }), 0.5, 0.7)), false);
    // Trop éloigné du profil : surprendre n’est pas déranger.
    assert.equal(estPepite(candidat(titre({ popularite: 12 }), 0.5, 0.1)), false);
  });

  test('injecte la part attendue de pépites dans la sélection', () => {
    const grandPublic = Array.from({ length: 15 }, (_, i) =>
      candidat(titre({ popularite: 80, genres: [`G${i}`], realisateurs: [`R${i}`] }), 0.8 - i * 0.01, 0.7),
    );
    const reserve = Array.from({ length: 6 }, (_, i) =>
      candidat(titre({ popularite: 10, genres: [`P${i}`], realisateurs: [`PR${i}`] }), 0.4, 0.6),
    );

    const { liste, idsPepites } = injecterPepites(grandPublic, [...grandPublic, ...reserve], 15);
    assert.equal(liste.length, 15);
    assert.ok(idsPepites.size >= 2, `attendu ~18 % de pépites sur 15, reçu ${idsPepites.size}`);
    assert.equal(new Set(liste.map((c) => c.titre.id)).size, liste.length, 'aucun doublon');
  });

  test('sans réserve disponible, la sélection reste intacte', () => {
    const selection = Array.from({ length: 10 }, (_, i) =>
      candidat(titre({ popularite: 90, genres: [`G${i}`] }), 0.8, 0.7),
    );
    const { liste } = injecterPepites(selection, selection, 10);
    assert.equal(liste.length, 10);
  });
});
