import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  age,
  ageALaSortie,
  autoriseParAge,
  bonusEpoque,
  classificationMaximale,
  estNostalgique,
  generation,
} from './epoque.ts';
import { profil, titre } from './aide-tests.ts';

describe('génération', () => {
  test('classe correctement les années de naissance', () => {
    assert.equal(generation(1958), 'Baby-boomer');
    assert.equal(generation(1975), 'Génération X');
    assert.equal(generation(1990), 'Millennial');
    assert.equal(generation(2004), 'Génération Z');
    assert.equal(generation(2015), 'Génération Alpha');
  });

  test('calcule l’âge à la sortie', () => {
    assert.equal(ageALaSortie(1990, 2005), 15);
    assert.equal(age(1990, 2026), 36);
  });
});

describe('bonus d’époque', () => {
  const p = profil({ anneeNaissance: 1990 });

  test('maximal dans la fenêtre de nostalgie (8-20 ans)', () => {
    // Sorti quand la personne avait 14 ans.
    assert.equal(bonusEpoque(titre({ annee: 2004 }), p, 2026), 1);
    // Bornes incluses : 8 ans et 20 ans.
    assert.equal(bonusEpoque(titre({ annee: 1998 }), p, 2026), 1);
    assert.equal(bonusEpoque(titre({ annee: 2010 }), p, 2026), 1);
  });

  test('plus faible hors de la fenêtre', () => {
    const horsFenetre = bonusEpoque(titre({ annee: 1975 }), p, 2026);
    assert.ok(horsFenetre < 1, 'un film de 1975 ne doit pas être « nostalgique » pour un natif de 1990');
    assert.ok(horsFenetre >= 0);
  });

  test('les sorties très récentes gardent un bonus plancher', () => {
    // Exigence : ne jamais enfermer l’utilisateur dans son passé.
    const recent = bonusEpoque(titre({ annee: 2025 }), p, 2026);
    assert.ok(recent >= 0.6, `le plancher d’actualité doit s’appliquer (reçu ${recent})`);
  });

  test('la fenêtre de nostalgie suit l’année de naissance', () => {
    const jeune = profil({ anneeNaissance: 2008 });
    assert.equal(estNostalgique(titre({ annee: 2020 }), jeune), true);
    assert.equal(estNostalgique(titre({ annee: 2020 }), p), false);
    assert.equal(estNostalgique(titre({ annee: 2004 }), p), true);
  });

  test('la préférence « récent » amplifie les sorties récentes', () => {
    const neutre = profil({ anneeNaissance: 1970, epoquePreferee: 'indifferent' });
    const amateurDeNeuf = profil({ anneeNaissance: 1970, epoquePreferee: 'recent' });
    const t = titre({ annee: 2024 });
    assert.ok(bonusEpoque(t, amateurDeNeuf, 2026) >= bonusEpoque(t, neutre, 2026));
  });

  test('reste toujours borné entre 0 et 1', () => {
    for (const annee of [1930, 1960, 1990, 2010, 2026]) {
      const v = bonusEpoque(titre({ annee }), p, 2026);
      assert.ok(v >= 0 && v <= 1, `bonus hors bornes pour ${annee} : ${v}`);
    }
  });
});

describe('classification d’âge', () => {
  test('un mineur n’accède jamais aux contenus -16 et -18', () => {
    const ado = 14;
    assert.equal(autoriseParAge(titre({ classification: '12' }), ado), true);
    assert.equal(autoriseParAge(titre({ classification: '16' }), ado), false);
    assert.equal(autoriseParAge(titre({ classification: '18' }), ado), false);
  });

  test('un adulte accède à tout, sauf contrainte de compagnie', () => {
    assert.equal(classificationMaximale(30, null), '18');
    // Soirée en famille : plafond imposé à « 10 » même pour un adulte.
    assert.equal(classificationMaximale(30, '10'), '10');
  });

  test('la contrainte de compagnie ne peut pas assouplir l’âge réel', () => {
    // Un ado de 14 ans « en famille » ne remonte pas à 18.
    assert.equal(classificationMaximale(14, '10'), '10');
    // Et sans contrainte, il reste plafonné par son âge.
    assert.equal(classificationMaximale(14, null), '12');
  });
});
