import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { genererPourquoi, profilCinema, referenceLaPlusProche } from './explication.ts';
import { scorerTitre } from './score.ts';
import { vecteurVide } from './profil.ts';
import { contexte, historique, profil, titre } from './aide-tests.ts';

const interstellar = titre({
  titre: 'Interstellar',
  genres: ['Science-Fiction', 'Drame'],
  motsCles: ['espace', 'temps'],
  realisateurs: ['Christopher Nolan'],
  annee: 2014,
});

describe('référence citée', () => {
  test('retient le titre aimé le plus proche', () => {
    const proche = titre({ genres: ['Science-Fiction', 'Drame'], motsCles: ['espace'], annee: 2016 });
    const lointain = titre({ genres: ['Comédie'], motsCles: ['mariage'], annee: 1998 });
    assert.equal(referenceLaPlusProche(proche, [interstellar, lointain])?.titre, 'Interstellar');
  });

  test('ne cite rien si rien ne ressemble', () => {
    const rien = titre({ genres: ['Western'], motsCles: ['cheval'], annee: 1966 });
    assert.equal(referenceLaPlusProche(rien, [titre({ genres: ['Comédie'], motsCles: ['bureau'] })]), null);
  });

  test('ne se cite pas lui-même', () => {
    assert.equal(referenceLaPlusProche(interstellar, [interstellar]), null);
  });
});

describe('phrase « Pourquoi pour toi »', () => {
  const p = profil({
    anneeNaissance: 1990,
    gouts: { ...vecteurVide(), genres: { 'Science-Fiction': 0.9 }, realisateurs: { 'Denis Villeneuve': 0.9 } },
  });

  function pourquoi(t: ReturnType<typeof titre>, ctx = contexte(), options = {}) {
    const { detail } = scorerTitre(t, p, historique(), ctx, 2026);
    return genererPourquoi(t, detail, p, ctx, { anneeCourante: 2026, ...options });
  }

  test('cite un titre aimé quand il y en a un de proche', () => {
    const t = titre({ genres: ['Science-Fiction', 'Drame'], motsCles: ['espace'], annee: 2021 });
    const phrase = pourquoi(t, contexte(), { titresAimes: [interstellar] });
    assert.match(phrase, /Interstellar/);
  });

  test('cite le réalisateur quand c’est lui qui fait monter le titre', () => {
    const t = titre({ genres: ['Western'], realisateurs: ['Denis Villeneuve'] });
    assert.match(pourquoi(t), /Denis Villeneuve/);
  });

  test('mentionne l’humeur du moment', () => {
    const phrase = pourquoi(titre({ genres: ['Thriller'] }), contexte({ humeur: 'adrenaline' }));
    assert.match(phrase, /ce soir/);
    assert.match(phrase, /intense/);
  });

  test('mentionne la nostalgie quand le titre tombe dans la bonne fenêtre', () => {
    // Né en 1990 → 2004 = 14 ans.
    const phrase = pourquoi(titre({ annee: 2004, genres: ['Science-Fiction'] }));
    assert.match(phrase, /14 ans/);
  });

  test('signale une pépite', () => {
    const phrase = pourquoi(titre({ annee: 1968, genres: ['Western'] }), contexte(), { pepite: true });
    assert.match(phrase, /pépite/i);
  });

  test('signale une soirée en famille', () => {
    const phrase = pourquoi(titre({ annee: 1968, genres: ['Familial'] }), contexte({ compagnie: 'famille' }));
    assert.match(phrase, /famille/);
  });

  test('reste une phrase propre en toutes circonstances', () => {
    for (const humeur of [null, 'fatigue', 'frisson', 'reflexion'] as const) {
      for (const annee of [1966, 1995, 2004, 2026]) {
        const phrase = pourquoi(titre({ annee, genres: ['Drame'] }), contexte({ humeur }));
        assert.ok(phrase.length > 20 && phrase.endsWith('.'), `phrase douteuse : « ${phrase} »`);
        assert.ok(!phrase.includes('  '), 'double espace détecté');
        assert.ok(!phrase.includes('undefined'));
      }
    }
  });
});

describe('profil cinéma de fin de test', () => {
  test('produit un intitulé et un résumé cohérents', () => {
    const p = profil({
      pseudo: 'Nina',
      anneeNaissance: 1993,
      tonalitePreferee: 'intense',
      genresAdores: ['Thriller'],
      genresDetestes: ['Comédie musicale'],
    });
    const { titre: intitule, resume } = profilCinema(p);
    assert.ok(intitule.length > 5);
    assert.match(resume, /Millennial/);
    assert.match(resume, /thriller/);
    assert.match(resume, /sans comédie musicale/);
  });

  test('est déterministe : deux appels donnent le même résultat', () => {
    const p = profil({ pseudo: 'Nina' });
    assert.deepEqual(profilCinema(p), profilCinema(p));
  });
});
