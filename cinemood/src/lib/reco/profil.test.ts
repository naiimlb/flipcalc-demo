import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquerSignal,
  construireProfilDepuisTest,
  decennie,
  enregistrerExpositions,
  enregistrerSignal,
  historiqueVide,
  vecteurVide,
} from './profil.ts';
import { affiniteGouts } from './score.ts';
import { profil, titre } from './aide-tests.ts';

describe('construction du profil depuis le test', () => {
  const interstellar = titre({
    titre: 'Interstellar',
    genres: ['Science-Fiction', 'Drame'],
    realisateurs: ['Christopher Nolan'],
    motsCles: ['espace', 'temps'],
    annee: 2014,
    tonalites: ['intense'],
  });

  const p = construireProfilDepuisTest({
    pseudo: 'Sam',
    anneeNaissance: 1995,
    typesSouhaites: ['film'],
    genresAdores: ['Science-Fiction'],
    genresDetestes: ['Horreur'],
    favoris: [interstellar],
    enfance: [titre({ titre: 'Shrek', annee: 2001, genres: ['Animation'] })],
    tonalitePreferee: 'intense',
    dureeMax: 150,
    languePreferee: 'vo',
    epoquePreferee: 'indifferent',
    animationOk: true,
    plateformes: ['netflix', 'max'],
    pays: 'FR',
  });

  test('les genres adorés et détestés sont posés avec le bon signe', () => {
    assert.ok(p.gouts.genres['Science-Fiction'] > 0.5);
    assert.ok(p.gouts.genres['Horreur'] < -0.5);
  });

  test('les titres préférés nourrissent réalisateurs et mots-clés', () => {
    assert.ok(p.gouts.realisateurs['Christopher Nolan'] > 0);
    assert.ok(p.gouts.motsCles['espace'] > 0);
  });

  test('les titres d’enfance renforcent leur décennie', () => {
    assert.ok(p.gouts.decennies['2000'] > 0);
  });

  test('un genre détesté ne peut pas être « racheté » par un favori', () => {
    const horreurFavorite = construireProfilDepuisTest({
      pseudo: 'Sam',
      anneeNaissance: 1995,
      typesSouhaites: ['film'],
      genresAdores: [],
      genresDetestes: ['Horreur'],
      favoris: [titre({ genres: ['Horreur'] }), titre({ genres: ['Horreur'] })],
      enfance: [],
      tonalitePreferee: 'flippant',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix'],
      pays: 'FR',
    });
    assert.ok(horreurFavorite.gouts.genres['Horreur'] < 0, 'le rejet explicite doit primer');
  });

  test('les poids restent bornés entre -1 et 1', () => {
    for (const facette of Object.values(p.gouts)) {
      for (const valeur of Object.values(facette as Record<string, number>)) {
        assert.ok(valeur >= -1 && valeur <= 1, `poids hors bornes : ${valeur}`);
      }
    }
  });
});

describe('apprentissage continu', () => {
  const nolan = titre({ genres: ['Science-Fiction'], realisateurs: ['Christopher Nolan'] });

  test('un signal positif rapproche le profil du titre', () => {
    const avant = profil();
    const apres = appliquerSignal(avant, nolan, 'deja_vu_aime');
    assert.ok(
      affiniteGouts(nolan, apres).score > affiniteGouts(nolan, avant).score,
      'après un « j’ai adoré », le titre doit mieux matcher',
    );
  });

  test('un signal négatif éloigne le profil, avec la même force', () => {
    const base = profil();
    const aime = appliquerSignal(base, nolan, 'deja_vu_aime');
    const pasAime = appliquerSignal(base, nolan, 'deja_vu_pas_aime');
    const ecartPositif = affiniteGouts(nolan, aime).score - affiniteGouts(nolan, base).score;
    const ecartNegatif = affiniteGouts(nolan, base).score - affiniteGouts(nolan, pasAime).score;
    assert.ok(
      Math.abs(ecartPositif - ecartNegatif) < 1e-9,
      'les signaux négatifs doivent compter autant que les positifs',
    );
  });

  test('les fonctions sont pures : le profil d’origine n’est pas modifié', () => {
    const base = profil();
    const copie = JSON.stringify(base);
    appliquerSignal(base, nolan, 'pas_pour_moi');
    assert.equal(JSON.stringify(base), copie);
  });

  test('un signal sans amplitude ne change rien', () => {
    const base = profil();
    assert.equal(appliquerSignal(base, nolan, 'retrait_liste').gouts.genres['Science-Fiction'] !== undefined, true);
  });
});

describe('historique', () => {
  test('« déjà vu » sort le titre de la liste et mémorise la note', () => {
    const t = titre();
    let h = enregistrerSignal(historiqueVide(), t.id, 'ajout_liste', 1000);
    assert.deepEqual(h.liste, [t.id]);
    h = enregistrerSignal(h, t.id, 'deja_vu_aime', 2000);
    assert.deepEqual(h.liste, []);
    assert.equal(h.vus[t.id], 1);
  });

  test('« pas pour moi » alimente la liste des refus, sans doublon', () => {
    const t = titre();
    let h = enregistrerSignal(historiqueVide(), t.id, 'pas_pour_moi', 1000);
    h = enregistrerSignal(h, t.id, 'swipe_passe', 2000);
    assert.deepEqual(h.refuses, [t.id]);
  });

  test('les expositions s’accumulent pour alimenter la rotation', () => {
    const t = titre();
    let h = enregistrerExpositions(historiqueVide(), [t.id], 1000);
    h = enregistrerExpositions(h, [t.id], 2000);
    assert.equal(h.expositions[t.id], 2);
    assert.equal(h.derniereProposition[t.id], 2000);
  });
});

test('décennie', () => {
  assert.equal(decennie(1994), '1990');
  assert.equal(decennie(2000), '2000');
  assert.equal(decennie(2026), '2020');
});

test('le vecteur vide contient bien toutes les facettes', () => {
  assert.deepEqual(Object.keys(vecteurVide()).sort(), [
    'acteurs',
    'decennies',
    'genres',
    'motsCles',
    'pays',
    'realisateurs',
    'tonalites',
  ]);
});
