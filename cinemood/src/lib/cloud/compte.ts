/* =====================================================================
   compte.ts — La passerelle entre l'app et Supabase.
   ---------------------------------------------------------------------
   Chaque fonction reçoit le client Supabase en premier argument plutôt
   que d'en construire un elle-même : c'est ce qui la rend testable sans
   base de données réelle — dans les tests, on lui passe un client
   factice qui respecte la même interface (voir `compte.test.ts`).

   `import type` n'entraîne aucune dépendance à l'exécution : ce fichier
   ne charge jamais `@supabase/supabase-js`, il ne fait qu'appeler les
   méthodes d'un objet qu'on lui donne. C'est pour ça qu'il est testable
   dans cet environnement, sans installer aucun paquet.
   ===================================================================== */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  construireHistorique,
  depuisLigneProfil,
  titresConnusDepuisListe,
  versLigneProfil,
} from './mappage.ts';
import type { LigneExposition, LigneListe, LigneProfil, LigneRefus } from './mappage.ts';
import type { Compagnie, Historique, Humeur, ProfilUtilisateur, Signal, Titre } from '../reco/types.ts';

/* ---------------------------------------------------------------------
   Résultats des opérations : jamais d'exception qui remonte jusqu'à
   l'interface sans un message compréhensible.
   --------------------------------------------------------------------- */

export interface ResultatEcriture {
  ok: boolean;
  /** Message déjà traduit en français, prêt à afficher. */
  erreur?: string;
}

export interface ResultatAuth {
  ok: boolean;
  erreur?: string;
  /** `true` si l'inscription attend une confirmation par e-mail. */
  confirmationRequise?: boolean;
}

const MESSAGE_ECRITURE_ECHEC = 'La sauvegarde a échoué. Vérifie ta connexion et réessaie.';

/** Erreur levée quand le chargement de l'état d'un compte échoue. */
export class ErreurChargementCompte extends Error {}

/* ---------------------------------------------------------------------
   1. Authentification.
   --------------------------------------------------------------------- */

/** Traduit les messages d'erreur Supabase, que l'utilisateur ne lit pas en anglais. */
export function traduireErreurAuth(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'Un compte existe déjà avec cet e-mail.';
  }
  if (m.includes('password should be different')) return 'Choisis un mot de passe différent de l’actuel.';
  if (m.includes('password') && (m.includes('short') || m.includes('at least') || m.includes('6 characters'))) {
    return 'Mot de passe trop court : 8 caractères minimum.';
  }
  if (m.includes('security purposes') || m.includes('rate limit') || m.includes('too many')) {
    return 'Trop de tentatives : patiente une minute avant de réessayer.';
  }
  if (m.includes('user not found')) return 'Aucun compte ne correspond à cette adresse.';
  if (m.includes('email not confirmed')) return 'Confirme d’abord ton adresse e-mail : regarde tes messages.';
  if (m.includes('email') && (m.includes('invalid') || m.includes('valid'))) {
    return 'Cette adresse e-mail ne semble pas valide.';
  }
  if (m.includes('same_password') || m.includes('should be different')) {
    return 'Ton nouveau mot de passe doit être différent de l’ancien.';
  }
  return 'Quelque chose a échoué. Réessaie dans un instant.';
}

/**
 * Inscription par e-mail et mot de passe.
 * Si le projet exige une confirmation par e-mail, Supabase renvoie un
 * utilisateur mais aucune session : c'est ce que `confirmationRequise`
 * détecte, pour que l'écran affiche « vérifie ta boîte mail » plutôt que
 * de faire comme si la personne était déjà connectée.
 */
export async function inscrire(
  client: SupabaseClient,
  email: string,
  motDePasse: string,
  emailRedirectTo: string,
): Promise<ResultatAuth> {
  const { data, error } = await client.auth.signUp({
    email,
    password: motDePasse,
    options: { emailRedirectTo },
  });
  if (error) return { ok: false, erreur: traduireErreurAuth(error.message) };
  return { ok: true, confirmationRequise: Boolean(data.user) && !data.session };
}

export async function connecter(client: SupabaseClient, email: string, motDePasse: string): Promise<ResultatAuth> {
  const { error } = await client.auth.signInWithPassword({ email, password: motDePasse });
  return error ? { ok: false, erreur: traduireErreurAuth(error.message) } : { ok: true };
}

export async function deconnecter(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}

export async function demanderReinitialisationMotDePasse(
  client: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<ResultatAuth> {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  return error ? { ok: false, erreur: traduireErreurAuth(error.message) } : { ok: true };
}

export async function definirNouveauMotDePasse(client: SupabaseClient, motDePasse: string): Promise<ResultatAuth> {
  const { error } = await client.auth.updateUser({ password: motDePasse });
  return error ? { ok: false, erreur: traduireErreurAuth(error.message) } : { ok: true };
}

export async function changerEmail(client: SupabaseClient, email: string): Promise<ResultatAuth> {
  const { error } = await client.auth.updateUser({ email });
  return error ? { ok: false, erreur: traduireErreurAuth(error.message) } : { ok: true };
}

export async function supprimerCompteCloud(client: SupabaseClient): Promise<ResultatAuth> {
  const { error } = await client.rpc('supprimer_mon_compte');
  return error ? { ok: false, erreur: 'La suppression a échoué. Réessaie dans un instant.' } : { ok: true };
}

/* ---------------------------------------------------------------------
   2. Chargement complet de l'état d'un compte.
   ---------------------------------------------------------------------
   Tout ou rien : si une seule des quatre lectures échoue (réseau coupé,
   projet mal configuré), on lève une exception plutôt que de renvoyer un
   état partiel qui ferait croire à un compte vide — un retour de
   confiance après une simple coupure réseau ne doit jamais ressembler à
   une perte de données.
   --------------------------------------------------------------------- */

export interface EtatCompteCharge {
  profil: ProfilUtilisateur | null;
  historique: Historique;
  titresConnus: Record<string, Titre>;
  plateformesChoisies: boolean;
  testTermine: boolean;
}

export async function chargerEtatCompte(client: SupabaseClient, utilisateurId: string): Promise<EtatCompteCharge> {
  const [profilRes, listeRes, refusRes, expositionRes] = await Promise.all([
    client.from('profils').select('*').eq('id', utilisateurId).maybeSingle(),
    client.from('liste').select('titre_id, statut, appreciation, titre_cache').eq('utilisateur_id', utilisateurId),
    client.from('refus').select('titre_id').eq('utilisateur_id', utilisateurId),
    client.from('expositions').select('titre_id, nb, derniere').eq('utilisateur_id', utilisateurId),
  ]);

  for (const [nom, resultat] of [
    ['profil', profilRes],
    ['liste', listeRes],
    ['refus', refusRes],
    ['expositions', expositionRes],
  ] as const) {
    if (resultat.error) {
      throw new ErreurChargementCompte(
        `Impossible de charger « ${nom} » : ${resultat.error.message}`,
      );
    }
  }

  const ligneProfil = profilRes.data as LigneProfil | null;
  const lignesListe = (listeRes.data ?? []) as LigneListe[];
  const idsRefus = ((refusRes.data ?? []) as LigneRefus[]).map((r) => r.titre_id);
  const lignesExposition = (expositionRes.data ?? []) as LigneExposition[];

  return {
    profil: depuisLigneProfil(ligneProfil),
    historique: construireHistorique(lignesListe, idsRefus, lignesExposition),
    titresConnus: titresConnusDepuisListe(lignesListe),
    plateformesChoisies: ligneProfil?.plateformes_ok ?? false,
    testTermine: ligneProfil?.test_termine ?? false,
  };
}

/* ---------------------------------------------------------------------
   3. Écritures : une fonction par action possible dans l'app.
   --------------------------------------------------------------------- */

export async function enregistrerProfilCloud(
  client: SupabaseClient,
  utilisateurId: string,
  profil: ProfilUtilisateur,
  plateformesChoisies: boolean,
  testTermine: boolean,
): Promise<ResultatEcriture> {
  const { error } = await client
    .from('profils')
    .upsert(versLigneProfil(utilisateurId, profil, plateformesChoisies, testTermine));
  if (error) {
    console.error('[cloud] enregistrerProfilCloud', error.message);
    return { ok: false, erreur: MESSAGE_ECRITURE_ECHEC };
  }
  return { ok: true };
}

/**
 * Enregistre un signal (like, pas pour moi, ajout à la liste…).
 *
 * Trois choses se produisent à chaque signal, et les trois doivent
 * atteindre la base : le journal qui garde l'historique, le vecteur de
 * goûts qui vient de bouger (`appliquerSignal`, côté appelant, l'a déjà
 * déplacé — on le pousse ici), et l'effet propre au signal sur « Ma
 * liste » ou sur les refus.
 */
export async function enregistrerSignalCloud(
  client: SupabaseClient,
  utilisateurId: string,
  titre: Titre,
  signal: Signal,
  profilMisAJour: ProfilUtilisateur,
  plateformesChoisies: boolean,
  testTermine: boolean,
): Promise<ResultatEcriture> {
  const messages: string[] = [];

  const { error: erreurInteraction } = await client
    .from('interactions')
    .insert({ utilisateur_id: utilisateurId, titre_id: titre.id, signal });
  if (erreurInteraction) messages.push(erreurInteraction.message);

  // Le vecteur de goûts a bougé dans `appliquerSignal` (côté appelant) :
  // sans cette ligne, l'apprentissage resterait local à l'appareil et ne
  // suivrait jamais la personne d'un appareil à l'autre. On repousse les
  // indicateurs d'étape tels qu'ils sont réellement, plutôt que de les
  // supposer acquis : un signal ne devrait de toute façon jamais survenir
  // avant la fin de l'installation, mais autant ne rien réécrire à tort.
  const { error: erreurProfil } = await client
    .from('profils')
    .upsert(versLigneProfil(utilisateurId, profilMisAJour, plateformesChoisies, testTermine));
  if (erreurProfil) messages.push(erreurProfil.message);

  if (signal === 'ajout_liste' || signal === 'swipe_garde') {
    const { error } = await client
      .from('liste')
      .upsert({ utilisateur_id: utilisateurId, titre_id: titre.id, statut: 'a_voir', titre_cache: titre });
    if (error) messages.push(error.message);
  } else if (signal === 'retrait_liste') {
    const { error } = await client.from('liste').delete().match({ utilisateur_id: utilisateurId, titre_id: titre.id });
    if (error) messages.push(error.message);
  } else if (signal === 'deja_vu_aime' || signal === 'deja_vu_pas_aime') {
    const { error } = await client.from('liste').upsert({
      utilisateur_id: utilisateurId,
      titre_id: titre.id,
      statut: 'vu',
      appreciation: signal === 'deja_vu_aime' ? 1 : -1,
      titre_cache: titre,
    });
    if (error) messages.push(error.message);
  } else if (signal === 'pas_pour_moi' || signal === 'swipe_passe') {
    const { error } = await client.from('refus').upsert({ utilisateur_id: utilisateurId, titre_id: titre.id });
    if (error) messages.push(error.message);
  }

  if (messages.length > 0) {
    console.error('[cloud] enregistrerSignalCloud', messages.join(' · '));
    return { ok: false, erreur: MESSAGE_ECRITURE_ECHEC };
  }
  return { ok: true };
}

/** Note l'exposition d'une liste de titres, de façon atomique (voir la fonction SQL). */
export async function enregistrerExpositionsCloud(client: SupabaseClient, titreIds: string[]): Promise<ResultatEcriture> {
  if (titreIds.length === 0) return { ok: true };
  const { error } = await client.rpc('enregistrer_expositions', { p_titre_ids: titreIds });
  if (error) {
    console.error('[cloud] enregistrerExpositionsCloud', error.message);
    return { ok: false, erreur: MESSAGE_ECRITURE_ECHEC };
  }
  return { ok: true };
}

/** Journalise une humeur choisie sur l'écran d'accueil. */
export async function enregistrerHumeurCloud(
  client: SupabaseClient,
  utilisateurId: string,
  humeur: Humeur,
  compagnie: Compagnie,
): Promise<ResultatEcriture> {
  const { error } = await client.from('humeurs_choisies').insert({ utilisateur_id: utilisateurId, humeur, compagnie });
  if (error) {
    console.error('[cloud] enregistrerHumeurCloud', error.message);
    return { ok: false, erreur: MESSAGE_ECRITURE_ECHEC };
  }
  return { ok: true };
}
