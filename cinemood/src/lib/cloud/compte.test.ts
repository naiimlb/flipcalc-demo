/* =====================================================================
   compte.test.ts — Le parcours « compte A / compte B », exécuté pour de
   vrai contre le vrai code de synchronisation.
   ---------------------------------------------------------------------
   Ce que ce fichier prouve : les fonctions de `compte.ts` — CELLES QUI
   SERONT APPELÉES PAR L'APP EN PRODUCTION, mot pour mot, sans aucune
   réécriture pour le test — produisent le bon résultat quand on les
   fait tourner contre un client qui respecte le même contrat que la
   Row Level Security du vrai schéma SQL (`faux-client.ts`) : chaque
   ligne n'est visible et modifiable que par son propriétaire, tel que
   déterminé par la session en cours.

   ⚠️  CE QUE CE FICHIER NE PROUVE PAS. Il ne s'exécute pas contre un
   vrai projet Supabase : aucune requête réseau n'est faite, aucun
   e-mail n'est réellement envoyé, et les règles RLS du fichier
   `supabase/schema.sql` ne sont pas, elles, exécutées ici — c'est une
   fidèle REIMPLÉMENTATION de leur contrat en mémoire. Un test qui passe
   ici garantit que la logique de l'app est correcte ; il ne garantit
   pas qu'un projet Supabase réel, mal configuré (policy oubliée, table
   non protégée), se comporterait pareil. C'est pourquoi `schema.sql`
   doit être exécuté tel quel, sans modification, sur le vrai projet.

   Lancer :  node --test src/lib/cloud/*.test.ts
   ===================================================================== */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { creerFauxClient } from './faux-client.ts';
import {
  chargerEtatCompte,
  connecter,
  deconnecter,
  definirNouveauMotDePasse,
  demanderReinitialisationMotDePasse,
  enregistrerExpositionsCloud,
  enregistrerHumeurCloud,
  enregistrerProfilCloud,
  enregistrerSignalCloud,
  inscrire,
  supprimerCompteCloud,
} from './compte.ts';
import { appliquerSignal, construireProfilDepuisTest, vecteurVide } from '../reco/profil.ts';
import type { Titre } from '../reco/types.ts';

/** Un titre minimal, suffisant pour les écritures de test. */
function titre(partiel: Partial<Titre> = {}): Titre {
  return {
    id: 'film:550',
    tmdbId: 550,
    type: 'film',
    titre: 'Fight Club',
    annee: 1999,
    duree: 139,
    saisons: null,
    genres: ['Drame', 'Thriller'],
    motsCles: ['identité'],
    realisateurs: ['David Fincher'],
    acteurs: ['Brad Pitt'],
    pays: ['US'],
    langueOriginale: 'en',
    note: 8.4,
    nbVotes: 29400,
    popularite: 44,
    classification: '16',
    plateformes: ['netflix'],
    synopsis: '',
    tonalites: ['intense'],
    rythme: 'modere',
    affiche: null,
    bandeAnnonce: null,
    animation: false,
    ...partiel,
  };
}

const REDIRECT = 'https://cinemood.example/bienvenue/plateformes';

describe('Parcours complet — création, déconnexion, reconnexion', () => {
  test('un compte retrouve EXACTEMENT ses données après déconnexion puis reconnexion', async () => {
    const client = creerFauxClient();

    // --- 1. Inscription ------------------------------------------------
    const inscription = await inscrire(client, 'sarah@test.fr', 'motdepasse123', REDIRECT);
    assert.equal(inscription.ok, true);
    assert.equal(inscription.confirmationRequise, false, 'sans confirmation activée, la session doit s’ouvrir tout de suite');

    const { data } = await client.auth.getUser();
    const idSarah = data.user!.id;

    // --- 2. Plateformes puis test de personnalité -----------------------
    const profilInitial = construireProfilDepuisTest({
      pseudo: 'Sarah',
      anneeNaissance: 1998,
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Thriller', 'Drame'],
      genresDetestes: ['Horreur'],
      favoris: [titre()],
      enfance: [],
      tonalitePreferee: 'intense',
      dureeMax: null,
      languePreferee: 'vo',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix', 'max'],
      pays: 'FR',
    });
    const ecriture = await enregistrerProfilCloud(client, idSarah, profilInitial, true, true);
    assert.equal(ecriture.ok, true);

    // --- 3. Elle ajoute un film à sa liste -------------------------------
    const filmAime = titre();
    const profilApresSignal = appliquerSignal(profilInitial, filmAime, 'ajout_liste');
    const ecritureSignal = await enregistrerSignalCloud(client, idSarah, filmAime, 'ajout_liste', profilApresSignal, true, true);
    assert.equal(ecritureSignal.ok, true);

    // --- 4. Elle regarde une bande-annonce, une exposition est notée ----
    await enregistrerExpositionsCloud(client, [filmAime.id]);
    await enregistrerHumeurCloud(client, idSarah, 'adrenaline', 'seul');

    // --- 5. Elle se déconnecte -------------------------------------------
    await deconnecter(client);
    const apresDeconnexion = await client.auth.getUser();
    assert.equal(apresDeconnexion.data.user, null);

    // --- 6. Elle se reconnecte --------------------------------------------
    const connexion = await connecter(client, 'sarah@test.fr', 'motdepasse123');
    assert.equal(connexion.ok, true);

    // --- 7. Tout doit être là, exactement --------------------------------
    const etat = await chargerEtatCompte(client, idSarah);
    assert.ok(etat.profil);
    assert.equal(etat.profil.pseudo, 'Sarah');
    assert.deepEqual(etat.profil.plateformes, ['netflix', 'max']);
    assert.deepEqual(etat.profil.genresAdores, ['Thriller', 'Drame']);
    assert.equal(etat.plateformesChoisies, true);
    assert.equal(etat.testTermine, true);

    // La liste : le film ajouté doit y être, avec sa fiche complète.
    assert.deepEqual(etat.historique.liste, [filmAime.id]);
    assert.equal(etat.titresConnus[filmAime.id]?.titre, 'Fight Club');

    // L'exposition notée avant la déconnexion doit avoir survécu.
    assert.equal(etat.historique.expositions[filmAime.id], 1);

    // Le vecteur de goûts modifié par le signal doit avoir été poussé et
    // relu correctement : c'est le correctif principal de cette tâche.
    assert.ok(
      etat.profil.gouts.genres['Drame'] > profilInitial.gouts.genres['Drame'],
      'le poids « Drame » doit avoir bougé après le signal, et avoir été sauvegardé',
    );

    // L'humeur choisie doit avoir été journalisée.
    const humeurs = client.inspecter('humeurs_choisies');
    assert.equal(humeurs.length, 1);
    assert.equal(humeurs[0].humeur, 'adrenaline');
    assert.equal(humeurs[0].utilisateur_id, idSarah);
  });

  test('« pas pour moi » place le titre dans les refus, définitivement', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'marc@test.fr', password: 'motdepasse123' });
    const { data } = await client.auth.getUser();
    const idMarc = data.user!.id;

    const profil = construireProfilDepuisTest({
      pseudo: 'Marc',
      anneeNaissance: 1988,
      typesSouhaites: ['film', 'serie'],
      genresAdores: [],
      genresDetestes: [],
      favoris: [],
      enfance: [],
      tonalitePreferee: 'intense',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix'],
      pays: 'FR',
    });
    await enregistrerProfilCloud(client, idMarc, profil, true, true);

    const refuse = titre({ id: 'film:999', titre: 'Un film refusé' });
    const profilApres = appliquerSignal(profil, refuse, 'pas_pour_moi');
    await enregistrerSignalCloud(client, idMarc, refuse, 'pas_pour_moi', profilApres, true, true);

    const etat = await chargerEtatCompte(client, idMarc);
    assert.deepEqual(etat.historique.refuses, ['film:999']);
    // Un titre refusé ne doit apparaître ni dans « à voir » ni dans « vus ».
    assert.deepEqual(etat.historique.liste, []);
    assert.deepEqual(etat.historique.vus, {});
  });

  test('deux expositions du même titre incrémentent, sans course', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'tom@test.fr', password: 'motdepasse123' });
    const { data } = await client.auth.getUser();
    const idTom = data.user!.id;

    await enregistrerExpositionsCloud(client, ['film:1', 'film:2']);
    await enregistrerExpositionsCloud(client, ['film:1']);

    const etat = await chargerEtatCompte(client, idTom);
    assert.equal(etat.historique.expositions['film:1'], 2);
    assert.equal(etat.historique.expositions['film:2'], 1);
  });
});

describe('Isolation entre deux comptes — le cœur de la demande', () => {
  test('un compte flambant neuf ne voit RIEN du premier compte', async () => {
    const client = creerFauxClient();

    // Compte A : inscription, plateformes, test, un titre en liste.
    await inscrire(client, 'compteA@test.fr', 'motdepasse123', REDIRECT);
    const idA = (await client.auth.getUser()).data.user!.id;
    const profilA = construireProfilDepuisTest({
      pseudo: 'Compte A',
      anneeNaissance: 1990,
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Horreur'],
      genresDetestes: [],
      favoris: [],
      enfance: [],
      tonalitePreferee: 'flippant',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['canal'],
      pays: 'FR',
    });
    await enregistrerProfilCloud(client, idA, profilA, true, true);
    await enregistrerSignalCloud(client, idA, titre({ id: 'film:1' }), 'ajout_liste', profilA, true, true);
    await enregistrerHumeurCloud(client, idA, 'frisson', 'seul');
    await deconnecter(client);

    // Compte B, tout nouveau, sur le MÊME client (même « navigateur »).
    await inscrire(client, 'compteB@test.fr', 'motdepasse123', REDIRECT);
    const idB = (await client.auth.getUser()).data.user!.id;
    assert.notEqual(idA, idB);

    const etatB = await chargerEtatCompte(client, idB);
    assert.equal(etatB.profil?.pseudo, '', 'un compte neuf a un pseudo vide, pas celui du compte A');
    assert.equal(etatB.plateformesChoisies, false);
    assert.equal(etatB.testTermine, false);
    assert.deepEqual(etatB.profil?.plateformes, []);
    assert.deepEqual(etatB.profil?.genresAdores, []);
    assert.deepEqual(etatB.historique.liste, [], 'la liste de B ne doit contenir aucun titre de A');
    assert.deepEqual(etatB.titresConnus, {});

    const humeursB = client.inspecter('humeurs_choisies').filter((h) => h.utilisateur_id === idB);
    assert.equal(humeursB.length, 0, 'B ne doit voir aucune humeur journalisée par A');
  });

  test('même en cas d’erreur de code demandant l’ID du mauvais compte, rien ne fuit', async () => {
    // Ce test va délibérément à l'encontre de l'usage normal : on est
    // connecté en tant que B, et on appelle `chargerEtatCompte` avec
    // l'identifiant de A — pour vérifier que la barrière tient même si
    // un bug côté app venait à mélanger les deux identifiants.
    const client = creerFauxClient();

    await inscrire(client, 'a2@test.fr', 'motdepasse123', REDIRECT);
    const idA = (await client.auth.getUser()).data.user!.id;
    const profilA = construireProfilDepuisTest({
      pseudo: 'A secret',
      anneeNaissance: 1990,
      typesSouhaites: ['film'],
      genresAdores: [],
      genresDetestes: [],
      favoris: [],
      enfance: [],
      tonalitePreferee: 'intense',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix'],
      pays: 'FR',
    });
    await enregistrerProfilCloud(client, idA, profilA, true, true);
    await enregistrerSignalCloud(client, idA, titre({ id: 'secret-de-a' }), 'ajout_liste', profilA, true, true);
    await deconnecter(client);

    await client.auth.signUp({ email: 'b2@test.fr', password: 'motdepasse123' });
    // Session courante : B. On demande quand même l'état de A.
    const etat = await chargerEtatCompte(client, idA);

    assert.equal(etat.profil, null, 'la ligne de A ne doit pas être lisible sous la session de B');
    assert.deepEqual(etat.historique.liste, []);
    assert.deepEqual(etat.titresConnus, {});
  });
});

describe('Gestion du compte', () => {
  test('changer de mot de passe, puis se reconnecter avec le nouveau', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'motdepasse@test.fr', password: 'ancienmdp1' });

    const resultat = await definirNouveauMotDePasse(client, 'nouveaumdp1');
    assert.equal(resultat.ok, true);

    await deconnecter(client);
    const echec = await connecter(client, 'motdepasse@test.fr', 'ancienmdp1');
    assert.equal(echec.ok, false, 'l’ancien mot de passe ne doit plus fonctionner');

    const succes = await connecter(client, 'motdepasse@test.fr', 'nouveaumdp1');
    assert.equal(succes.ok, true);
  });

  test('changer d’e-mail met à jour l’identifiant de connexion', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'ancien@test.fr', password: 'motdepasse123' });

    const { changerEmail } = await import('./compte.ts');
    const resultat = await changerEmail(client, 'nouveau@test.fr');
    assert.equal(resultat.ok, true);

    await deconnecter(client);
    const avecAncien = await connecter(client, 'ancien@test.fr', 'motdepasse123');
    assert.equal(avecAncien.ok, false);
    const avecNouveau = await connecter(client, 'nouveau@test.fr', 'motdepasse123');
    assert.equal(avecNouveau.ok, true);
  });

  test('mot de passe oublié : le lien envoyé permet de définir un nouveau mot de passe', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'oubli@test.fr', password: 'motdepasse123' });
    await deconnecter(client);

    const demande = await demanderReinitialisationMotDePasse(client, 'oubli@test.fr', REDIRECT);
    assert.equal(demande.ok, true);
    assert.equal(client.dernierEmailReinitialise(), 'oubli@test.fr');

    // Cliquer sur le lien reçu établit une session de récupération :
    // on simule cette étape en reconnectant directement (le client
    // factice n'implémente pas le jeton de lien, seulement son effet).
    await client.auth.signInWithPassword({ email: 'oubli@test.fr', password: 'motdepasse123' });
    const resultat = await definirNouveauMotDePasse(client, 'nouveaumotdepasse');
    assert.equal(resultat.ok, true);

    await deconnecter(client);
    const connexion = await connecter(client, 'oubli@test.fr', 'nouveaumotdepasse');
    assert.equal(connexion.ok, true);
  });

  test('demander une réinitialisation pour un e-mail inconnu ne confirme rien de sensible', async () => {
    const client = creerFauxClient();
    const resultat = await demanderReinitialisationMotDePasse(client, 'personne@test.fr', REDIRECT);
    // La réponse doit être identique, que le compte existe ou non :
    // sinon, un formulaire de réinitialisation devient un moyen de
    // vérifier quelles adresses sont inscrites (comportement Supabase).
    assert.equal(resultat.ok, true, 'la réponse ne doit jamais révéler si le compte existe');
    assert.equal(
      client.dernierEmailReinitialise(),
      null,
      'mais aucun lien ne doit réellement être envoyé pour une adresse inconnue',
    );
  });

  test('supprimer son compte efface le profil, la liste et l’historique — sans toucher aux autres', async () => {
    const client = creerFauxClient();

    await inscrire(client, 'asupprimer@test.fr', 'motdepasse123', REDIRECT);
    const idASupprimer = (await client.auth.getUser()).data.user!.id;
    const profil = construireProfilDepuisTest({
      pseudo: 'À supprimer',
      anneeNaissance: 1990,
      typesSouhaites: ['film'],
      genresAdores: [],
      genresDetestes: [],
      favoris: [],
      enfance: [],
      tonalitePreferee: 'intense',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix'],
      pays: 'FR',
    });
    await enregistrerProfilCloud(client, idASupprimer, profil, true, true);
    await enregistrerSignalCloud(client, idASupprimer, titre(), 'ajout_liste', profil, true, true);
    await enregistrerHumeurCloud(client, idASupprimer, 'joyeux', 'couple');

    // Un autre compte, qui doit survivre intact à la suppression du premier.
    await deconnecter(client);
    await inscrire(client, 'survivant@test.fr', 'motdepasse123', REDIRECT);
    const idSurvivant = (await client.auth.getUser()).data.user!.id;
    await enregistrerProfilCloud(
      client,
      idSurvivant,
      { ...profil, pseudo: 'Survivant' },
      true,
      true,
    );
    await deconnecter(client);

    await connecter(client, 'asupprimer@test.fr', 'motdepasse123');
    const suppression = await supprimerCompteCloud(client);
    assert.equal(suppression.ok, true);

    // Le compte supprimé ne peut plus se reconnecter.
    const tentative = await connecter(client, 'asupprimer@test.fr', 'motdepasse123');
    assert.equal(tentative.ok, false);

    // Ses données ont disparu des tables (vérifié directement, en
    // contournant la RLS, exactement comme le ferait un audit).
    assert.equal(client.inspecter('profils').some((p) => p.id === idASupprimer), false);
    assert.equal(client.inspecter('liste').some((l) => l.utilisateur_id === idASupprimer), false);
    assert.equal(client.inspecter('humeurs_choisies').some((h) => h.utilisateur_id === idASupprimer), false);

    // Le compte survivant, lui, n'a pas bougé.
    await connecter(client, 'survivant@test.fr', 'motdepasse123');
    const etatSurvivant = await chargerEtatCompte(client, idSurvivant);
    assert.equal(etatSurvivant.profil?.pseudo, 'Survivant');
  });
});

describe('Inscription avec confirmation par e-mail obligatoire', () => {
  test('aucune session tant que le lien n’a pas été suivi', async () => {
    const client = creerFauxClient({ confirmationEmailRequise: true });

    const inscription = await inscrire(client, 'aconfirmer@test.fr', 'motdepasse123', REDIRECT);
    assert.equal(inscription.ok, true);
    assert.equal(inscription.confirmationRequise, true);

    const avantConfirmation = await connecter(client, 'aconfirmer@test.fr', 'motdepasse123');
    assert.equal(avantConfirmation.ok, false, 'se connecter avant confirmation doit échouer');

    client.confirmerEmail('aconfirmer@test.fr');
    const apresConfirmation = await connecter(client, 'aconfirmer@test.fr', 'motdepasse123');
    assert.equal(apresConfirmation.ok, true);
  });
});

describe('Messages d’erreur', () => {
  test('un e-mail déjà utilisé produit un message clair', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'existe@test.fr', password: 'motdepasse123' });
    const resultat = await inscrire(client, 'existe@test.fr', 'autremdp123', REDIRECT);
    assert.equal(resultat.ok, false);
    assert.match(resultat.erreur ?? '', /existe déjà/);
  });

  test('un mauvais mot de passe produit un message clair, sans dire lequel des deux est faux', async () => {
    const client = creerFauxClient();
    await client.auth.signUp({ email: 'x@test.fr', password: 'bonmotdepasse' });
    const resultat = await connecter(client, 'x@test.fr', 'mauvaismotdepasse');
    assert.equal(resultat.ok, false);
    assert.match(resultat.erreur ?? '', /incorrect/);
  });
});

test('un profil vide reste cohérent avec `vecteurVide` (garde-fou de régression)', () => {
  // Sécurité minimale : si `vecteurVide()` change de forme un jour, ce
  // test casse ici plutôt que silencieusement dans `mappage.ts`.
  const v = vecteurVide();
  assert.deepEqual(Object.keys(v).sort(), [
    'acteurs',
    'decennies',
    'genres',
    'motsCles',
    'pays',
    'realisateurs',
    'tonalites',
  ]);
});
