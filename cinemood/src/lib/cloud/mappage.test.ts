import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { vecteurVide } from '../reco/profil.ts';
import {
  construireHistorique,
  depuisLigneProfil,
  titresConnusDepuisListe,
  versLigneProfil,
} from './mappage.ts';
import type { LigneExposition, LigneListe, LigneProfil } from './mappage.ts';
import type { ProfilUtilisateur } from '../reco/types.ts';

/** Une ligne `profils` complète, pour ne pas la réécrire dans chaque test. */
function ligneProfil(partiel: Partial<LigneProfil> = {}): LigneProfil {
  return {
    id: 'u-1',
    pseudo: 'Léa',
    annee_naissance: 1995,
    genre_personne: null,
    pays: 'FR',
    plateformes: ['netflix', 'max'],
    types_souhaites: ['film', 'serie'],
    genres_adores: ['Thriller'],
    genres_detestes: ['Horreur'],
    tonalite_preferee: 'intense',
    duree_max: 150,
    langue_preferee: 'vo',
    epoque_preferee: 'indifferent',
    animation_ok: true,
    a_eviter: [],
    interets: [],
    gouts: { genres: { Thriller: 0.8 }, motsCles: {}, realisateurs: {}, acteurs: {}, pays: {}, decennies: {}, tonalites: {} },
    plateformes_ok: true,
    test_termine: true,
    ...partiel,
  };
}

function profil(partiel: Partial<ProfilUtilisateur> = {}): ProfilUtilisateur {
  return {
    pseudo: 'Léa',
    anneeNaissance: 1995,
    typesSouhaites: ['film', 'serie'],
    genresAdores: ['Thriller'],
    genresDetestes: ['Horreur'],
    tonalitePreferee: 'intense',
    dureeMax: 150,
    languePreferee: 'vo',
    epoquePreferee: 'indifferent',
    animationOk: true,
    plateformes: ['netflix', 'max'],
    pays: 'FR',
    gouts: { ...vecteurVide(), genres: { Thriller: 0.8 } },
    aEviter: [],
    interets: [],
    ...partiel,
  };
}

describe('depuisLigneProfil', () => {
  test('reconstruit fidèlement une ligne bien formée', () => {
    const p = depuisLigneProfil(ligneProfil());
    assert.ok(p);
    assert.equal(p.pseudo, 'Léa');
    assert.equal(p.anneeNaissance, 1995);
    assert.deepEqual(p.plateformes, ['netflix', 'max']);
    assert.deepEqual(p.genresAdores, ['Thriller']);
    assert.equal(p.gouts.genres['Thriller'], 0.8);
    assert.equal(p.dureeMax, 150);
  });

  test('renvoie null pour une ligne absente', () => {
    assert.equal(depuisLigneProfil(null), null);
  });

  test('dégrade proprement une tonalité ou une langue invalide', () => {
    const p = depuisLigneProfil(
      ligneProfil({ tonalite_preferee: 'n’importe quoi', langue_preferee: 'klingon', epoque_preferee: 'toto' }),
    );
    assert.ok(p);
    assert.equal(p.tonalitePreferee, 'intense');
    assert.equal(p.languePreferee, 'indifferent');
    assert.equal(p.epoquePreferee, 'indifferent');
  });

  test('un vecteur de goûts corrompu redevient un vecteur vide plutôt que de planter', () => {
    const p1 = depuisLigneProfil(ligneProfil({ gouts: null }));
    const p2 = depuisLigneProfil(ligneProfil({ gouts: 'texte inattendu' }));
    const p3 = depuisLigneProfil(ligneProfil({ gouts: { genres: { ok: 0.5, casse: 'pas un nombre' } } }));
    assert.deepEqual(p1?.gouts, vecteurVide());
    assert.deepEqual(p2?.gouts, vecteurVide());
    assert.deepEqual(p3?.gouts.genres, { ok: 0.5 });
  });

  test('un type de contenu vide retombe sur « film et série »', () => {
    const p = depuisLigneProfil(ligneProfil({ types_souhaites: [] }));
    assert.deepEqual(p?.typesSouhaites, ['film', 'serie']);
  });

  test('le genre déclaré facultatif devient `undefined`, jamais `null`', () => {
    const p = depuisLigneProfil(ligneProfil({ genre_personne: null }));
    assert.equal(p?.genrePersonne, undefined);
    const p2 = depuisLigneProfil(ligneProfil({ genre_personne: 'Non binaire' }));
    assert.equal(p2?.genrePersonne, 'Non binaire');
  });
});

describe('versLigneProfil', () => {
  test('produit une ligne complète, avec les indicateurs demandés', () => {
    const ligne = versLigneProfil('u-42', profil(), true, false);
    assert.equal(ligne.id, 'u-42');
    assert.equal(ligne.pseudo, 'Léa');
    assert.equal(ligne.plateformes_ok, true);
    assert.equal(ligne.test_termine, false);
    assert.deepEqual(ligne.plateformes, ['netflix', 'max']);
  });

  test('aller-retour : profil → ligne → profil reste stable', () => {
    const original = profil({ genrePersonne: 'Femme' });
    const ligne = versLigneProfil('u-1', original, true, true) as unknown as LigneProfil;
    const reconstruit = depuisLigneProfil(ligne);
    assert.deepEqual(reconstruit, original);
  });
});

describe('construireHistorique', () => {
  const listeVus: LigneListe = { titre_id: 'film:2', statut: 'vu', appreciation: 1, titre_cache: {} };
  const listeAVoir: LigneListe = { titre_id: 'film:1', statut: 'a_voir', appreciation: null, titre_cache: {} };
  const expo: LigneExposition = { titre_id: 'film:1', nb: 3, derniere: '2026-01-15T10:00:00.000Z' };

  test('sépare correctement « à voir » et « déjà vu »', () => {
    const h = construireHistorique([listeVus, listeAVoir], [], []);
    assert.deepEqual(h.liste, ['film:1']);
    assert.deepEqual(h.vus, { 'film:2': 1 });
  });

  test('les refus sont repris tels quels', () => {
    const h = construireHistorique([], ['film:5', 'film:6'], []);
    assert.deepEqual(h.refuses, ['film:5', 'film:6']);
  });

  test('les expositions et leur horodatage sont convertis en millisecondes', () => {
    const h = construireHistorique([], [], [expo]);
    assert.equal(h.expositions['film:1'], 3);
    assert.equal(h.derniereProposition['film:1'], Date.parse('2026-01-15T10:00:00.000Z'));
  });

  test('une appréciation absente ou invalide n’entre pas dans `vus`', () => {
    const h = construireHistorique(
      [{ titre_id: 'film:9', statut: 'vu', appreciation: null, titre_cache: {} }],
      [],
      [],
    );
    assert.deepEqual(h.vus, {});
  });

  test('un historique vide reste un historique valide (nouveau compte)', () => {
    const h = construireHistorique([], [], []);
    assert.deepEqual(h, { vus: {}, refuses: [], liste: [], expositions: {}, derniereProposition: {} });
  });
});

describe('titresConnusDepuisListe', () => {
  test('ne garde que les fiches dont la forme est exploitable', () => {
    const cache = titresConnusDepuisListe([
      { titre_id: 'film:1', statut: 'a_voir', appreciation: null, titre_cache: { id: 'film:1', titre: 'X', genres: ['Drame'] } },
      { titre_id: 'film:2', statut: 'vu', appreciation: 1, titre_cache: { incomplet: true } },
      { titre_id: 'film:3', statut: 'vu', appreciation: -1, titre_cache: null },
    ]);
    assert.deepEqual(Object.keys(cache), ['film:1']);
    assert.equal(cache['film:1'].titre, 'X');
  });
});
