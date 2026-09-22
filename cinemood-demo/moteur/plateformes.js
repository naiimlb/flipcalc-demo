/* Généré par scripts/construire-demo.mjs — NE PAS MODIFIER À LA MAIN.
   Source : cinemood/src/lib/reco/plateformes.ts
   Les types TypeScript ont été retirés ; la logique est identique. */

/* =====================================================================
   plateformes.ts — Référentiel des services de streaming (région FR).
   ---------------------------------------------------------------------
   Une seule source de vérité, partagée par le moteur (filtrage strict)
   et par l'interface (grille de sélection, logo sur les cartes).
   `idTmdb` permet de faire le pont avec /watch/providers de TMDB.
   ===================================================================== */

                             
             
              
                                                   
                 
                                                                   
                    
                                                                    
                  
                                                                           
                    
                                                        
               
 

export const PLATEFORMES               = [
  { id: 'netflix', nom: 'Netflix', idTmdb: 8, gratuite: false, couleur: '#E50914', initiales: 'N', lien: 'https://www.netflix.com/fr/' },
  { id: 'prime', nom: 'Prime Video', idTmdb: 119, gratuite: false, couleur: '#00A8E1', initiales: 'pv', lien: 'https://www.primevideo.com/' },
  { id: 'disney', nom: 'Disney+', idTmdb: 337, gratuite: false, couleur: '#113CCF', initiales: 'D+', lien: 'https://www.disneyplus.com/fr-fr' },
  { id: 'canal', nom: 'Canal+', idTmdb: 381, gratuite: false, couleur: '#000000', initiales: 'C+', lien: 'https://www.canalplus.com/' },
  { id: 'appletv', nom: 'Apple TV+', idTmdb: 350, gratuite: false, couleur: '#1C1C1E', initiales: '', lien: 'https://tv.apple.com/fr' },
  { id: 'max', nom: 'Max', idTmdb: 1899, gratuite: false, couleur: '#0046FF', initiales: 'max', lien: 'https://www.max.com/fr/fr' },
  { id: 'paramount', nom: 'Paramount+', idTmdb: 531, gratuite: false, couleur: '#0064FF', initiales: 'P+', lien: 'https://www.paramountplus.com/fr/' },
  { id: 'ocs', nom: 'OCS', idTmdb: 56, gratuite: false, couleur: '#FF6B00', initiales: 'ocs', lien: 'https://www.ocs.fr/' },
  { id: 'crunchyroll', nom: 'Crunchyroll', idTmdb: 283, gratuite: false, couleur: '#F47521', initiales: 'cr', lien: 'https://www.crunchyroll.com/fr/' },
  { id: 'adn', nom: 'ADN', idTmdb: 415, gratuite: false, couleur: '#0099FF', initiales: 'adn', lien: 'https://animationdigitalnetwork.fr/' },
  { id: 'universcine', nom: 'UniversCiné', idTmdb: 61, gratuite: false, couleur: '#C4A661', initiales: 'uc', lien: 'https://www.universcine.com/' },

  // --- Offres gratuites -------------------------------------------------
  { id: 'arte', nom: 'arte.tv', idTmdb: 234, gratuite: true, couleur: '#FF3B30', initiales: 'arte', lien: 'https://www.arte.tv/fr/' },
  { id: 'francetv', nom: 'france.tv', idTmdb: 236, gratuite: true, couleur: '#0F6BFF', initiales: 'ftv', lien: 'https://www.france.tv/' },
  { id: 'tf1plus', nom: 'TF1+', idTmdb: 1754, gratuite: true, couleur: '#0A2A6B', initiales: 'TF1', lien: 'https://www.tf1.fr/' },
  { id: 'm6plus', nom: 'M6+', idTmdb: 138, gratuite: true, couleur: '#9B1B30', initiales: 'M6', lien: 'https://www.6play.fr/' },
  { id: 'plutotv', nom: 'Pluto TV', idTmdb: 300, gratuite: true, couleur: '#FFE000', initiales: 'pluto', lien: 'https://pluto.tv/fr/' },
];

/** Index par identifiant, pour les accès directs. */
export const PLATEFORME_PAR_ID                             = Object.fromEntries(
  PLATEFORMES.map((p) => [p.id, p]),
);

/** Identifiants des offres accessibles sans abonnement. */
export const PLATEFORMES_GRATUITES           = PLATEFORMES.filter((p) => p.gratuite).map((p) => p.id);

/** Correspondance provider TMDB → identifiant CinéMood. */
export const PLATEFORME_PAR_ID_TMDB                         = Object.fromEntries(
  PLATEFORMES.map((p) => [p.idTmdb, p.id]),
);

/**
 * Plateformes réellement utilisables pour filtrer.
 * Personne sans abonnement → uniquement les offres gratuites, comme
 * prévu par l'option « Je n'ai aucun abonnement ».
 */
export function plateformesEffectives(plateformesUtilisateur          )           {
  if (plateformesUtilisateur.length === 0) return PLATEFORMES_GRATUITES;
  return plateformesUtilisateur;
}
