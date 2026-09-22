/* =====================================================================
   api-client.ts — Les appels du navigateur vers nos routes d'API.
   ---------------------------------------------------------------------
   Aucun appel direct à TMDB depuis le navigateur : tout passe par
   /api/*, seul endroit où le jeton existe.
   ===================================================================== */

import type { Contexte, Historique, ProfilUtilisateur, Recommandation } from '@/lib/reco/types';

export interface ReponseRecommandations {
  recommandations: Recommandation[];
  candidatsRetenus: number;
  catalogueTotal: number;
  raisonVide: 'aucune_plateforme' | 'filtres_trop_stricts' | 'catalogue_vide' | null;
  /**
   * `true` quand l'humeur demandée ne laissait rien passer et que la
   * sélection a été élargie au-delà d'elle. L'écran doit le dire :
   * proposer autre chose que ce qui a été demandé, sans le signaler,
   * ferait passer le moteur pour défaillant.
   */
  humeurRelachee: boolean;
  modeDemo: boolean;
}

async function poster<T>(chemin: string, corps: unknown): Promise<T> {
  const reponse = await fetch(chemin, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!reponse.ok) {
    const details = (await reponse.json().catch(() => ({}))) as { erreur?: string };
    throw new Error(details.erreur ?? 'Le serveur n’a pas répondu correctement.');
  }
  return (await reponse.json()) as T;
}

export function demanderRecommandations(entree: {
  profil: ProfilUtilisateur;
  historique: Historique;
  contexte: Contexte;
  taille?: number;
}): Promise<ReponseRecommandations> {
  return poster<ReponseRecommandations>('/api/recommandations', entree);
}

export interface ReponseRecherche {
  resultats: Recommandation[];
  modeDemo: boolean;
}

export function rechercher(entree: {
  profil: ProfilUtilisateur;
  historique: Historique;
  contexte: Contexte;
  q?: string;
  filtres?: { genre?: string; plateforme?: string; dureeMax?: number; decennie?: number };
}): Promise<ReponseRecherche> {
  return poster<ReponseRecherche>('/api/recherche', entree);
}
