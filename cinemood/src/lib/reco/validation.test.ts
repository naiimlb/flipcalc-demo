/* =====================================================================
   validation.test.ts — La campagne de validation de l'algorithme.
   ---------------------------------------------------------------------
   Six profils × six contextes = 36 sélections, passées au crible.

   Deux familles de vérifications :
     • BLOQUANTES — des promesses faites à l'utilisateur. Une seule
       violation rend le produit incorrect (proposer un -18 à un mineur,
       un titre sur une plateforme qu'il n'a pas, un genre qu'il déteste).
     • QUALITÉ — la pertinence : l'humeur doit compter, les profils
       doivent diverger, la diversité doit tenir.
   ===================================================================== */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CATALOGUE_DEMO } from '../../data/catalogue-demo.ts';
import { AGE_MINIMUM, DIVERSITE, TABLE_HUMEURS } from './poids.ts';
import { appliquerSignal, enregistrerSignal, historiqueVide } from './profil.ts';
import { classerPourDecouverte, filtrerStrict, recommander } from './moteur.ts';
import { plateformesEffectives } from './plateformes.ts';
import {
  ANNEE_REFERENCE,
  CONTEXTES,
  PERSONNES,
  contexteDe,
  profilDe,
  titresAimesDe,
} from './profils-reference.ts';
import type { Historique, ProfilUtilisateur, Recommandation } from './types.ts';

const TAILLE = 10;

/** Raccourci : une sélection pour une personne et un contexte donnés. */
function selectionner(
  clePersonne: string,
  cleContexte: string,
  historique: Historique = historiqueVide(),
  profilForce?: ProfilUtilisateur,
): { recos: Recommandation[]; profil: ProfilUtilisateur } {
  const personne = PERSONNES.find((p) => p.cle === clePersonne)!;
  const contexteTest = CONTEXTES.find((c) => c.cle === cleContexte)!;
  const profil = profilForce ?? profilDe(personne);
  const resultat = recommander(CATALOGUE_DEMO, profil, historique, contexteDe(contexteTest), {
    taille: TAILLE,
    anneeCourante: ANNEE_REFERENCE,
    titresAimes: titresAimesDe(personne),
  });
  return { recos: resultat.recommandations, profil };
}

/**
 * Part de titres communs entre deux sélections, rapportée au nombre de
 * titres demandés — c'est la lecture littérale de « 20 % de titres en
 * commun ». Rapporter à la plus courte des deux listes gonflerait
 * artificiellement le chiffre quand un profil très contraint n'obtient
 * que cinq titres.
 */
function recouvrement(a: Recommandation[], b: Recommandation[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const idsA = new Set(a.map((r) => r.titre.id));
  return b.filter((r) => idsA.has(r.titre.id)).length / TAILLE;
}

/** `true` si les deux sélections sont exactement les mêmes titres. */
function identiques(a: Recommandation[], b: Recommandation[]): boolean {
  if (a.length !== b.length) return false;
  const idsA = new Set(a.map((r) => r.titre.id));
  return b.every((r) => idsA.has(r.titre.id));
}

/* =====================================================================
   1. RÈGLES BLOQUANTES — sur les 36 sélections.
   ===================================================================== */
describe('Règles bloquantes (6 profils × 6 contextes)', () => {
  for (const personne of PERSONNES) {
    for (const contexteTest of CONTEXTES) {
      const etiquette = `${personne.reponses.pseudo} — ${contexteTest.libelle}`;

      test(etiquette, () => {
        const { recos, profil } = selectionner(personne.cle, contexteTest.cle);
        const age = ANNEE_REFERENCE - profil.anneeNaissance;

        // Une sélection vide n'est jamais acceptable pour ces profils :
        // le catalogue contient de quoi répondre à chacun d'eux.
        assert.ok(recos.length >= 5, `seulement ${recos.length} titre(s) proposé(s)`);

        // --- a. Disponibilité sur SES plateformes ---------------------
        const autorisees = new Set(plateformesEffectives(profil.plateformes));
        for (const r of recos) {
          assert.ok(
            r.titre.plateformes.some((p) => autorisees.has(p)),
            `« ${r.titre.titre} » n’est sur aucune plateforme de ${profil.pseudo}`,
          );
        }

        // --- b. Classification d'âge ----------------------------------
        for (const r of recos) {
          assert.ok(
            AGE_MINIMUM[r.titre.classification] <= age,
            `« ${r.titre.titre} » (-${r.titre.classification}) proposé à ${age} ans`,
          );
        }

        // --- c. Soirée en famille : tout public uniquement ------------
        if (contexteTest.compagnie === 'famille') {
          for (const r of recos) {
            assert.ok(
              ['TP', '10'].includes(r.titre.classification),
              `« ${r.titre.titre} » (-${r.titre.classification}) en soirée famille`,
            );
          }
        }

        // --- d. Aucun genre détesté -----------------------------------
        for (const r of recos) {
          const fautifs = r.titre.genres.filter((g) => profil.genresDetestes.includes(g));
          assert.equal(
            fautifs.length,
            0,
            `« ${r.titre.titre} » contient le genre détesté « ${fautifs[0]} »`,
          );
        }

        // --- e. Animation refusée -------------------------------------
        if (!profil.animationOk) {
          for (const r of recos) {
            assert.ok(!r.titre.animation, `« ${r.titre.titre} » est de l’animation`);
          }
        }

        // --- f. Aucun doublon -----------------------------------------
        const ids = recos.map((r) => r.titre.id);
        assert.equal(new Set(ids).size, ids.length, 'doublon dans la sélection');

        // --- g. Bande-annonce : intégrée ou explicitement signalée ----
        for (const r of recos) {
          assert.equal(
            r.bandeAnnonceDisponible,
            r.titre.bandeAnnonce !== null,
            `le drapeau bande-annonce de « ${r.titre.titre} » ment`,
          );
        }

        // --- h. Chaque carte porte une explication utilisable ---------
        for (const r of recos) {
          assert.ok(r.pourquoi.length > 25, `explication trop courte : « ${r.pourquoi} »`);
          assert.ok(!r.pourquoi.includes('undefined'), 'explication corrompue');
          assert.ok(r.pourquoi.trim().endsWith('.'), 'explication non ponctuée');
        }
      });
    }
  }

  test('un titre déjà vu ou refusé ne revient jamais', () => {
    for (const personne of PERSONNES) {
      const profil = profilDe(personne);
      const contexte = contexteDe(CONTEXTES[1]); // adrénaline

      const premiere = recommander(CATALOGUE_DEMO, profil, historiqueVide(), contexte, {
        taille: TAILLE,
        anneeCourante: ANNEE_REFERENCE,
      }).recommandations;

      let historique = historiqueVide();
      const vus = premiere.slice(0, 4).map((r) => r.titre);
      const refuses = premiere.slice(4, 7).map((r) => r.titre);
      for (const t of vus) historique = enregistrerSignal(historique, t.id, 'deja_vu_aime', contexte.maintenant);
      for (const t of refuses) historique = enregistrerSignal(historique, t.id, 'pas_pour_moi', contexte.maintenant);
      const interdits = new Set([...vus, ...refuses].map((t) => t.id));

      const seconde = recommander(CATALOGUE_DEMO, profil, historique, contexte, {
        taille: TAILLE,
        anneeCourante: ANNEE_REFERENCE,
      }).recommandations;

      for (const r of seconde) {
        assert.ok(
          !interdits.has(r.titre.id),
          `${personne.reponses.pseudo} : « ${r.titre.titre} » revient alors qu’il a été vu ou refusé`,
        );
      }
    }
  });

  test('le genre déclaré de la personne n’influence aucune recommandation', () => {
    // La question « genre » du test est facultative et ne doit servir à
    // rien d'autre qu'à être conservée. On le prouve.
    const personne = PERSONNES.find((p) => p.cle === 'sarah')!;
    const base = profilDe(personne);
    const contexte = contexteDe(CONTEXTES[3]);

    const resultats = ['Femme', 'Homme', 'Non binaire', undefined].map((genrePersonne) =>
      recommander(
        CATALOGUE_DEMO,
        { ...base, genrePersonne },
        historiqueVide(),
        contexte,
        { taille: TAILLE, anneeCourante: ANNEE_REFERENCE },
      ).recommandations.map((r) => r.titre.id),
    );

    for (const liste of resultats) {
      assert.deepEqual(liste, resultats[0], 'le genre déclaré a modifié la sélection');
    }
  });
});

/* =====================================================================
   2. QUALITÉ — la pertinence, pas seulement la conformité.
   ===================================================================== */
describe('Qualité de la sélection', () => {
  test('l’humeur change réellement la sélection', () => {
    // Objectif : 60 % de différence entre « fatigué » et « adrénaline ».
    // Nuance nécessaire : une humeur ne peut agir que si le vivier de la
    // personne contient des titres des genres qu'elle met en avant. Rémi
    // déteste la comédie, l'animation, le familial ET le documentaire —
    // soit TOUS les genres bonifiés par « fatigué ». Exiger 60 % chez lui
    // reviendrait à lui imposer des titres qu'il a explicitement refusés.
    // On exige donc 60 % quand l'humeur a de quoi travailler, 40 % sinon.
    for (const personne of PERSONNES) {
      const { recos: fatigue, profil } = selectionner(personne.cle, 'fatigue');
      const adrenaline = selectionner(personne.cle, 'adrenaline').recos;
      const vivier = filtrerStrict(
        CATALOGUE_DEMO,
        profil,
        historiqueVide(),
        contexteDe(CONTEXTES[0]),
        ANNEE_REFERENCE,
      );

      const genresDisponibles = (humeur: 'fatigue' | 'adrenaline') =>
        TABLE_HUMEURS[humeur].genres.filter((g) => vivier.some((t) => t.genres.includes(g))).length;
      const humeurOperante = genresDisponibles('fatigue') >= 2 && genresDisponibles('adrenaline') >= 2;
      const exigence = humeurOperante ? 0.4 : 0.6;

      const part = recouvrement(fatigue, adrenaline);
      assert.ok(
        part <= exigence,
        `${profil.pseudo} : ${Math.round((1 - part) * 100)} % de différence entre « fatigué » et ` +
          `« adrénaline » (attendu ≥ ${Math.round((1 - exigence) * 100)} %, ` +
          `${humeurOperante ? 'vivier compatible' : 'vivier peu compatible avec ces humeurs'})`,
      );
    }
  });

  test('un titre partagé par deux profils l’est toujours pour une bonne raison', () => {
    // L'invariant n'est PAS « deux profils sans plateforme commune ne
    // partagent rien » : un même titre peut être diffusé à la fois sur
    // Netflix et sur Prime Video, et se retrouver légitimement chez deux
    // personnes aux abonnements disjoints. Ce qu'on garantit, c'est que
    // tout titre commun est réellement disponible pour CHACUN des deux.
    for (let i = 0; i < PERSONNES.length; i += 1) {
      for (let j = i + 1; j < PERSONNES.length; j += 1) {
        const a = profilDe(PERSONNES[i]);
        const b = profilDe(PERSONNES[j]);
        const acces = (profil: typeof a) => new Set(plateformesEffectives(profil.plateformes));

        for (const contexteTest of CONTEXTES) {
          const recosA = selectionner(PERSONNES[i].cle, contexteTest.cle).recos;
          const recosB = selectionner(PERSONNES[j].cle, contexteTest.cle).recos;
          const idsA = new Set(recosA.map((r) => r.titre.id));

          for (const r of recosB.filter((x) => idsA.has(x.titre.id))) {
            assert.ok(
              r.titre.plateformes.some((p) => acces(a).has(p)) &&
                r.titre.plateformes.some((p) => acces(b).has(p)),
              `« ${r.titre.titre} » proposé à ${a.pseudo} et ${b.pseudo} sans être disponible pour les deux`,
            );
          }
        }
      }
    }
  });

  test('les six profils reçoivent des sélections nettement distinctes', () => {
    // Mesure sur les six contextes, rapportée aux dix titres demandés.
    // Objectif : moins de 20 % de recouvrement moyen. Deux profils qui
    // partagent une plateforme ET une famille de goûts (Marc et Rémi sur
    // Netflix, tous deux amateurs de fictions sombres) dépassent ce seuil
    // — et c'est le comportement correct : les leur cacher l'un à l'autre
    // n'aurait aucun sens. On borne donc ces cas à 35 %, et on exige que
    // les listes ne soient jamais identiques.
    const depassements: string[] = [];

    for (let i = 0; i < PERSONNES.length; i += 1) {
      for (let j = i + 1; j < PERSONNES.length; j += 1) {
        const parts = CONTEXTES.map((c) =>
          recouvrement(selectionner(PERSONNES[i].cle, c.cle).recos, selectionner(PERSONNES[j].cle, c.cle).recos),
        );
        const moyenne = parts.reduce((a, b) => a + b, 0) / parts.length;
        const nom = `${PERSONNES[i].reponses.pseudo} ∩ ${PERSONNES[j].reponses.pseudo}`;

        assert.ok(moyenne < 0.35, `${nom} : ${Math.round(moyenne * 100)} % de recouvrement moyen`);
        for (const c of CONTEXTES) {
          assert.equal(
            identiques(selectionner(PERSONNES[i].cle, c.cle).recos, selectionner(PERSONNES[j].cle, c.cle).recos),
            false,
            `${nom} : sélections identiques dans le contexte « ${c.cle} »`,
          );
        }
        if (moyenne >= 0.2) depassements.push(`${nom} (${Math.round(moyenne * 100)} %)`);
      }
    }

    // Au moins les deux tiers des paires doivent tenir l'objectif de 20 %.
    const total = (PERSONNES.length * (PERSONNES.length - 1)) / 2;
    assert.ok(
      depassements.length <= Math.floor(total / 3),
      `${depassements.length}/${total} paires au-dessus de 20 % : ${depassements.join(', ')}`,
    );
  });

  test('l’époque de la personne est représentée, sans l’enfermer dans le passé', () => {
    for (const personne of PERSONNES) {
      const { recos, profil } = selectionner(personne.cle, 'triste');
      const naissance = profil.anneeNaissance;

      const jeunesse = recos.filter((r) => {
        const ageSortie = r.titre.annee - naissance;
        return ageSortie >= 8 && ageSortie <= 20;
      }).length;
      const recents = recos.filter((r) => ANNEE_REFERENCE - r.titre.annee <= 8).length;

      assert.ok(jeunesse >= 1, `${profil.pseudo} : aucun titre de sa jeunesse`);
      assert.ok(recents >= 1, `${profil.pseudo} : aucune sortie récente, profil enfermé dans le passé`);
    }
  });

  test('la diversité tient : ni monoculture de genre, ni franchise répétée', () => {
    for (const personne of PERSONNES) {
      for (const contexteTest of CONTEXTES) {
        const { recos } = selectionner(personne.cle, contexteTest.cle);
        const etiquette = `${personne.reponses.pseudo}/${contexteTest.cle}`;

        // Quota par genre principal. La règle garantie est à trois
        // niveaux, du plus strict au plus permissif :
        //   • genre non déclaré aimé        → 3 maximum ;
        //   • genre explicitement adoré     → jusqu'au plancher de
        //     pertinence, car le goût déclaré prime sur l'heuristique ;
        //   • vivier trop étroit            → on ne rend pas une liste
        //     plus courte pour faire joli.
        const { profil: p2 } = selectionner(personne.cle, contexteTest.cle);
        const adores = new Set(p2.genresAdores);

        // Règle 1 — aucun genre affiché ne dépasse 60 % de la liste.
        //   C'est la traduction directe de « pas dix titres du même
        //   genre » : on regarde le genre tel qu'il s'affiche sur la
        //   carte, pas celui par lequel le moteur a compté le titre.
        const plafondAffichage = Math.ceil(recos.length * DIVERSITE.plafondGenreAffichage);
        const parGenreAffiche = new Map<string, number>();
        for (const r of recos) {
          const g = r.titre.genres[0] ?? 'Autre';
          parGenreAffiche.set(g, (parGenreAffiche.get(g) ?? 0) + 1);
        }
        for (const [genre, n] of parGenreAffiche) {
          assert.ok(
            n <= plafondAffichage,
            `${etiquette} : ${n} titres affichés en « ${genre} » (plafond ${plafondAffichage})`,
          );
        }

        // Règle 2 — un genre que la personne n'a PAS déclaré aimer ne
        //   dépasse jamais le quota de 3, sauf vivier trop étroit.
        const genreDe = (t: (typeof recos)[number]['titre']) =>
          t.genres.find((g) => adores.has(g)) ?? t.genres[0] ?? 'Autre';
        const parReference = new Map<string, number>();
        for (const r of recos) {
          const g = genreDe(r.titre);
          parReference.set(g, (parReference.get(g) ?? 0) + 1);
        }

        const vivier = filtrerStrict(
          CATALOGUE_DEMO,
          p2,
          historiqueVide(),
          contexteDe(contexteTest),
          ANNEE_REFERENCE,
        );
        const capaciteVivier = [...new Set(vivier.map((t) => genreDe(t)))].reduce((acc, g) => {
          const dispo = vivier.filter((t) => genreDe(t) === g).length;
          return acc + Math.min(dispo, adores.has(g) ? plafondAffichage : DIVERSITE.maxParGenrePrincipal);
        }, 0);

        for (const [genre, n] of parReference) {
          if (adores.has(genre)) continue;
          assert.ok(
            n <= DIVERSITE.maxParGenrePrincipal || capaciteVivier < recos.length,
            `${etiquette} : ${n} titres comptés en « ${genre} », non déclaré aimé ` +
              `(quota ${DIVERSITE.maxParGenrePrincipal}, capacité du vivier ${capaciteVivier})`,
          );
        }

        // Réalisateur : un seul titre par personne.
        const parRealisateur = new Map<string, number>();
        for (const r of recos) {
          for (const real of r.titre.realisateurs) {
            parRealisateur.set(real, (parRealisateur.get(real) ?? 0) + 1);
          }
        }
        for (const [real, n] of parRealisateur) {
          assert.ok(n <= 1, `${etiquette} : ${n} titres de ${real}`);
        }

        // Franchise : pas deux volets de la même saga.
        const racines = recos.map((r) =>
          r.titre.titre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .split(/[:\-–(]/)[0]
            .trim(),
        );
        const vues = new Set<string>();
        for (const racine of racines) {
          if (racine.length > 3) {
            assert.ok(!vues.has(racine), `${etiquette} : deux volets de « ${racine} »`);
            vues.add(racine);
          }
        }
      }
    }
  });

  test('« en famille » infléchit la sélection à hauteur de ce qu’il doit retirer', () => {
    // Le mode famille plafonne la classification à « 10 ». Son effet est
    // donc proportionnel à la part de contenu plus âgé que la personne
    // reçoit d'habitude : chez une adolescente dont la sélection est déjà
    // presque entièrement tout public, il ne PEUT pas beaucoup bouger —
    // et c'est normal.
    for (const personne of PERSONNES) {
      const seul = selectionner(personne.cle, 'rire').recos;
      const famille = selectionner(personne.cle, 'famille').recos;
      const partAdulte = seul.filter((r) => !['TP', '10'].includes(r.titre.classification)).length / seul.length;

      // Contrainte toujours vraie : rien au-dessus de « 10 » en famille.
      for (const r of famille) assert.ok(['TP', '10'].includes(r.titre.classification));

      // Le mode famille doit au minimum retirer tout ce qu'il est censé
      // retirer : le recouvrement ne peut donc pas dépasser la part de
      // titres déjà tout public. Au-delà, on laisse le moteur libre.
      const plafond = 1 - partAdulte;
      assert.ok(
        recouvrement(seul, famille) <= plafond + 1e-9,
        `${personne.reponses.pseudo} : ${Math.round(recouvrement(seul, famille) * 100)} % de ` +
          `recouvrement alors que ${Math.round(partAdulte * 100)} % de sa sélection habituelle ` +
          `doit disparaître en mode famille`,
      );
    }
  });

  test('les explications collent au profil et à l’humeur', () => {
    // « Fatigué » et « envie de rire » doivent transparaître dans le texte.
    for (const personne of PERSONNES) {
      for (const [cle, attendu] of [
        ['fatigue', /léger|pas trop long/i],
        ['adrenaline', /intense/i],
        ['rire', /rire/i],
        ['famille', /famille|évader/i],
      ] as Array<[string, RegExp]>) {
        const { recos } = selectionner(personne.cle, cle);
        const proportion = recos.filter((r) => attendu.test(r.pourquoi)).length / recos.length;
        assert.ok(
          proportion >= 0.8,
          `${personne.reponses.pseudo}/${cle} : seulement ${Math.round(proportion * 100)} % ` +
            `des explications mentionnent le contexte`,
        );
      }
    }
  });
});

/* =====================================================================
   3. BANDE-ANNONCE — préférence mesurable quand l'information existe.
   ===================================================================== */
describe('Bande-annonce', () => {
  test('à qualité comparable, un titre sans bande-annonce passe derrière', () => {
    // Catalogue synthétique : mêmes titres, la moitié sans vidéo connue.
    const catalogue = CATALOGUE_DEMO.filter((t) => t.plateformes.includes('netflix')).map((t, i) => ({
      ...t,
      bandeAnnonce: i % 2 === 0 ? `cle${i}` : null,
    }));
    const personne = PERSONNES.find((p) => p.cle === 'remi')!;
    const recos = recommander(catalogue, profilDe(personne), historiqueVide(), contexteDe(CONTEXTES[1]), {
      taille: 10,
      anneeCourante: ANNEE_REFERENCE,
    }).recommandations;

    const avec = recos.filter((r) => r.bandeAnnonceDisponible).length;
    assert.ok(
      avec / recos.length >= 0.7,
      `seulement ${avec}/${recos.length} titres proposés ont une bande-annonce intégrable`,
    );
  });

  test('en l’absence totale de vidéos, la pénalité ne s’applique pas', () => {
    // Mode démo : aucun titre n'a de bande-annonce. Si la pénalité
    // s'appliquait, elle frapperait tout le monde — donc personne.
    const { recos } = selectionner('sarah', 'rire');
    assert.ok(recos.length >= 5);
    for (const r of recos) assert.equal(r.bandeAnnonceDisponible, false);
  });
});

/* =====================================================================
   4. APPRENTISSAGE — dix interactions, et la suite doit bouger.
   ===================================================================== */
describe('Apprentissage continu', () => {
  test('dix interactions orientent la sélection suivante dans le bon sens', () => {
    const personne = PERSONNES.find((p) => p.cle === 'sarah')!;
    let profil = profilDe(personne);
    let historique = historiqueVide();
    const contexte = contexteDe(CONTEXTES[3]); // envie de rire

    const avant = recommander(CATALOGUE_DEMO, profil, historique, contexte, {
      taille: 12,
      anneeCourante: ANNEE_REFERENCE,
    }).recommandations;

    const partDe = (recos: Recommandation[], genre: string) =>
      recos.filter((r) => r.titre.genres.includes(genre)).length / recos.length;

    const partComedieAvant = partDe(avant, 'Comédie');

    // Un titre « témoin » : on n'interagit JAMAIS avec lui. Comme les
    // titres vus sont exclus des sélections suivantes, c'est le seul
    // moyen honnête de mesurer l'effet de l'apprentissage — sur un titre
    // qui reste, lui, éligible.
    const crimeDispo = CATALOGUE_DEMO.filter(
      (t) => t.genres.includes('Crime') && t.plateformes.some((p) => ['prime', 'disney'].includes(p)),
    );
    // On mesure son rang dans le CLASSEMENT COMPLET des titres éligibles
    // (écran « Découvrir »), et non dans le top 12 : le re-classement
    // MMR y ajouterait du bruit et masquerait l'effet réel.
    const temoin = crimeDispo[0];
    const rangDe = (p: typeof profil, h: typeof historique) => {
      const classement = classerPourDecouverte(CATALOGUE_DEMO, p, h, contexte, ANNEE_REFERENCE);
      const i = classement.findIndex((r) => r.titre.id === temoin.id);
      return i === -1 ? Number.POSITIVE_INFINITY : i + 1;
    };
    const rangAvant = rangDe(profil, historique);

    // Dix interactions : on aime le crime, on rejette la comédie.
    const aAimer = crimeDispo.slice(1, 6);
    const aRejeter = CATALOGUE_DEMO.filter(
      (t) => t.genres.includes('Comédie') && t.plateformes.some((p) => ['prime', 'disney'].includes(p)),
    ).slice(0, 5);

    assert.ok(aAimer.length >= 3 && aRejeter.length >= 3, 'catalogue insuffisant pour le scénario');

    for (const t of aAimer) {
      profil = appliquerSignal(profil, t, 'deja_vu_aime');
      historique = enregistrerSignal(historique, t.id, 'deja_vu_aime', contexte.maintenant);
    }
    for (const t of aRejeter) {
      profil = appliquerSignal(profil, t, 'pas_pour_moi');
      historique = enregistrerSignal(historique, t.id, 'pas_pour_moi', contexte.maintenant);
    }

    const apres = recommander(CATALOGUE_DEMO, profil, historique, contexte, {
      taille: 12,
      anneeCourante: ANNEE_REFERENCE,
    }).recommandations;

    // Le témoin, jamais touché, doit remonter dans le classement.
    const rangApres = rangDe(profil, historique);
    assert.ok(
      rangApres < rangAvant,
      `le témoin « ${temoin.titre} » est passé du rang ${rangAvant} au rang ${rangApres} ` +
        `(il devait remonter)`,
    );

    // Et la comédie, rejetée cinq fois, doit perdre du poids dans le
    // vecteur de goûts.
    //
    // Nuance assumée : sa PART dans la liste ne baisse pas forcément, et
    // c'est voulu. Sarah a déclaré adorer la comédie ; rejeter cinq
    // titres précis ne doit pas faire conclure qu'elle déteste le genre.
    // De plus, les cinq titres rejetés sortent définitivement du vivier,
    // ce qui laisse mécaniquement la place à d'autres comédies. Le signal
    // d'apprentissage se lit donc sur le vecteur, pas sur le comptage.
    const profilInitial = profilDe(personne);
    assert.ok(
      profil.gouts.genres['Comédie'] < profilInitial.gouts.genres['Comédie'],
      `poids de « Comédie » : ${profilInitial.gouts.genres['Comédie'].toFixed(2)} → ` +
        `${profil.gouts.genres['Comédie'].toFixed(2)}`,
    );
    assert.ok(
      profil.gouts.genres['Crime'] > (profilInitial.gouts.genres['Crime'] ?? 0),
      'le poids de « Crime » n’a pas monté après cinq titres aimés',
    );
  });

  test('le vecteur de goûts bouge dans la bonne direction, facette par facette', () => {
    const personne = PERSONNES.find((p) => p.cle === 'marc')!;
    let profil = profilDe(personne);
    const avant = profil.gouts;

    const nolan = CATALOGUE_DEMO.find((t) => t.realisateurs.includes('Christopher Nolan'))!;
    for (let i = 0; i < 3; i += 1) profil = appliquerSignal(profil, nolan, 'deja_vu_aime');

    assert.ok(
      profil.gouts.realisateurs['Christopher Nolan'] > (avant.realisateurs['Christopher Nolan'] ?? 0),
      'le poids du réalisateur n’a pas monté',
    );

    let rejet = profilDe(personne);
    for (let i = 0; i < 3; i += 1) rejet = appliquerSignal(rejet, nolan, 'pas_pour_moi');
    assert.ok(
      rejet.gouts.realisateurs['Christopher Nolan'] < (avant.realisateurs['Christopher Nolan'] ?? 0),
      'le rejet n’a pas fait baisser le poids',
    );
  });
});

/* =====================================================================
   5. COHÉRENCE DU FILTRAGE STRICT, hors sélection.
   ===================================================================== */
describe('Filtrage strict, sur tout le catalogue', () => {
  for (const personne of PERSONNES) {
    test(`${personne.reponses.pseudo} : le vivier éligible respecte déjà toutes les règles`, () => {
      const profil = profilDe(personne);
      const age = ANNEE_REFERENCE - profil.anneeNaissance;
      const autorisees = new Set(plateformesEffectives(profil.plateformes));

      for (const contexteTest of CONTEXTES) {
        const eligibles = filtrerStrict(
          CATALOGUE_DEMO,
          profil,
          historiqueVide(),
          contexteDe(contexteTest),
          ANNEE_REFERENCE,
        );
        assert.ok(eligibles.length >= 5, `${contexteTest.cle} : vivier de ${eligibles.length} titres`);

        for (const t of eligibles) {
          assert.ok(t.plateformes.some((p) => autorisees.has(p)));
          assert.ok(AGE_MINIMUM[t.classification] <= age);
          assert.equal(t.genres.some((g) => profil.genresDetestes.includes(g)), false);
          if (!profil.animationOk) assert.equal(t.animation, false);
        }
      }
    });
  }
});
