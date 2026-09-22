import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { contexteParDefaut, dureeEffective, scoreDuree, scoreHumeur } from './humeur.ts';
import { contexte, titre } from './aide-tests.ts';

describe('durée', () => {
  test('une série est mesurée à l’épisode', () => {
    assert.equal(dureeEffective(titre({ type: 'serie', duree: 52, saisons: 3 })), 52);
    assert.equal(dureeEffective(titre({ type: 'serie', duree: null, saisons: 3 })), 45);
  });

  test('le score de durée décroît en s’éloignant de l’idéal', () => {
    assert.equal(scoreDuree(100, 100, 20), 1);
    assert.equal(scoreDuree(115, 100, 20), 1);
    assert.ok(scoreDuree(160, 100, 20) < scoreDuree(130, 100, 20));
    assert.ok(scoreDuree(300, 100, 20) >= 0);
  });
});

describe('correspondance humeur', () => {
  test('« adrénaline » préfère un thriller rapide à une romance lente', () => {
    const ctx = contexte({ humeur: 'adrenaline' });
    const thriller = titre({ genres: ['Thriller', 'Action'], tonalites: ['intense'], rythme: 'rapide', duree: 120 });
    const romance = titre({ genres: ['Romance'], tonalites: ['emouvant'], rythme: 'lent', duree: 120 });
    assert.ok(scoreHumeur(thriller, ctx) > scoreHumeur(romance, ctx));
  });

  test('« fatigué » préfère un format court et léger', () => {
    const ctx = contexte({ humeur: 'fatigue' });
    const courtLeger = titre({ genres: ['Comédie'], tonalites: ['leger'], rythme: 'modere', duree: 95 });
    const longIntense = titre({ genres: ['Guerre'], tonalites: ['intense'], rythme: 'lent', duree: 190 });
    assert.ok(scoreHumeur(courtLeger, ctx) > scoreHumeur(longIntense, ctx) + 0.3);
  });

  test('tard le soir, la durée pèse davantage', () => {
    const longFilm = titre({ duree: 190, genres: ['Drame'], rythme: 'lent' });
    const tot = scoreHumeur(longFilm, contexte({ heure: 19, jour: 2 }));
    const tard = scoreHumeur(longFilm, contexte({ heure: 23, jour: 2 }));
    assert.ok(tard < tot, 'un film de plus de 3 h doit perdre des points à 23 h');
  });

  test('le genre à contre-emploi de l’humeur est pénalisé', () => {
    const ctx = contexte({ humeur: 'rire' });
    const comedie = titre({ genres: ['Comédie'], tonalites: ['leger'], rythme: 'modere', duree: 100 });
    const horreur = titre({ genres: ['Horreur'], tonalites: ['flippant'], rythme: 'modere', duree: 100 });
    assert.ok(scoreHumeur(comedie, ctx) - scoreHumeur(horreur, ctx) > 0.4);
  });

  test('sans humeur choisie, le score reste exploitable', () => {
    const s = scoreHumeur(titre({ duree: 110 }), contexte({ humeur: null }));
    assert.ok(s > 0.4 && s <= 1, `score neutre attendu, reçu ${s}`);
  });

  test('« en famille » bonifie les genres familiaux', () => {
    const familial = titre({ genres: ['Familial', 'Animation'], duree: 100 });
    const autre = titre({ genres: ['Crime'], duree: 100 });
    const ctx = contexte({ compagnie: 'famille', humeur: null });
    assert.ok(scoreHumeur(familial, ctx) > scoreHumeur(autre, ctx));
  });

  test('toujours borné entre 0 et 1', () => {
    for (const humeur of ['fatigue', 'adrenaline', 'frisson', 'reflexion'] as const) {
      for (const duree of [40, 100, 400]) {
        const s = scoreHumeur(titre({ duree }), contexte({ humeur }));
        assert.ok(s >= 0 && s <= 1, `hors bornes : ${s}`);
      }
    }
  });
});

test('le contexte par défaut se déduit de l’horloge', () => {
  const ctx = contexteParDefaut(Date.UTC(2026, 0, 6, 12, 0, 0));
  assert.equal(ctx.humeur, null);
  assert.equal(ctx.compagnie, 'seul');
  assert.ok(ctx.heure >= 0 && ctx.heure <= 23);
});
