/* Généré par scripts/construire-demo.mjs — NE PAS MODIFIER À LA MAIN.
   Source : cinemood/src/lib/reco/profil.ts
   Les types TypeScript ont été retirés ; la logique est identique. */

/* =====================================================================
   profil.ts — Construction et apprentissage du vecteur de goûts.
   ---------------------------------------------------------------------
   Deux responsabilités :
     1. transformer les réponses au test de personnalité en un vecteur ;
     2. déplacer ce vecteur à chaque interaction (apprentissage continu).
   Toutes les fonctions sont pures : elles renvoient une nouvelle valeur
   plutôt que de modifier l'objet reçu.
   ===================================================================== */

import { APPRENTISSAGE } from './poids.js';
             
             
                    
         
        
              
               
                   
                   
           
                    

/** Un vecteur de goûts vierge. */
export function vecteurVide()               {
  return { genres: {}, motsCles: {}, realisateurs: {}, acteurs: {}, pays: {}, decennies: {}, tonalites: {} };
}

/** Un historique vierge. */
export function historiqueVide()             {
  return { vus: {}, refuses: [], liste: [], expositions: {}, derniereProposition: {} };
}

/** Borne une valeur dans l'intervalle autorisé du vecteur de goûts. */
export function borner(valeur        )         {
  return Math.max(APPRENTISSAGE.poidsMin, Math.min(APPRENTISSAGE.poidsMax, valeur));
}

/**
 * Ajoute `delta` au poids de `cle`, en restant dans les bornes.
 * Renvoie une copie : l'objet d'origine n'est jamais modifié.
 */
export function ajouterPoids(
  carte                        ,
  cle        ,
  delta        ,
)                         {
  if (!cle) return carte;
  const suivant = { ...carte };
  suivant[cle] = borner((suivant[cle] ?? 0) + delta);
  return suivant;
}

/** Applique `ajouterPoids` à une liste de clés d'un coup. */
function ajouterPoidsListe(
  carte                        ,
  cles          ,
  delta        ,
)                         {
  let resultat = carte;
  for (const cle of cles) resultat = ajouterPoids(resultat, cle, delta);
  return resultat;
}

/** La décennie d'une année, sous forme de clé : 1994 → « 1990 ». */
export function decennie(annee        )         {
  return String(Math.floor(annee / 10) * 10);
}

/**
 * Déplace le vecteur de goûts dans la direction d'un titre.
 * `amplitude` positive = on aime, négative = on rejette. Les deux ont la
 * même force : un « pas pour moi » compte autant qu'un « j'adore ».
 */
export function deplacerVersTitre(gouts              , titre       , amplitude        )               {
  const p = APPRENTISSAGE.partFacette;
  return {
    genres: ajouterPoidsListe(gouts.genres, titre.genres, amplitude * p.genres),
    motsCles: ajouterPoidsListe(
      gouts.motsCles,
      titre.motsCles.slice(0, APPRENTISSAGE.motsClesParSignal),
      amplitude * p.motsCles,
    ),
    realisateurs: ajouterPoidsListe(gouts.realisateurs, titre.realisateurs, amplitude * p.realisateurs),
    acteurs: ajouterPoidsListe(gouts.acteurs, titre.acteurs.slice(0, 4), amplitude * p.acteurs),
    pays: ajouterPoidsListe(gouts.pays, titre.pays, amplitude * p.pays),
    decennies: ajouterPoids(gouts.decennies, decennie(titre.annee), amplitude * p.decennies),
    tonalites: ajouterPoidsListe(gouts.tonalites, titre.tonalites, amplitude * p.tonalites),
  };
}

/**
 * Apprentissage continu : renvoie le profil mis à jour après une
 * interaction. C'est le point d'entrée unique côté application.
 */
export function appliquerSignal(
  profil                   ,
  titre       ,
  signal        ,
)                    {
  const amplitude = APPRENTISSAGE.amplitudes[signal] ?? 0;
  if (amplitude === 0) return profil;
  return { ...profil, gouts: deplacerVersTitre(profil.gouts, titre, amplitude) };
}

/** Met à jour l'historique après une interaction. */
export function enregistrerSignal(
  historique            ,
  titreId        ,
  signal        ,
  maintenant         = Date.now(),
)             {
  const suivant             = {
    vus: { ...historique.vus },
    refuses: [...historique.refuses],
    liste: [...historique.liste],
    expositions: { ...historique.expositions },
    derniereProposition: { ...historique.derniereProposition },
  };

  switch (signal) {
    case 'ajout_liste':
      if (!suivant.liste.includes(titreId)) suivant.liste.push(titreId);
      break;
    case 'retrait_liste':
      suivant.liste = suivant.liste.filter((id) => id !== titreId);
      break;
    case 'deja_vu_aime':
      suivant.vus[titreId] = 1;
      suivant.liste = suivant.liste.filter((id) => id !== titreId);
      break;
    case 'deja_vu_pas_aime':
      suivant.vus[titreId] = -1;
      suivant.liste = suivant.liste.filter((id) => id !== titreId);
      break;
    case 'pas_pour_moi':
    case 'swipe_passe':
      if (!suivant.refuses.includes(titreId)) suivant.refuses.push(titreId);
      break;
    case 'swipe_garde':
      if (!suivant.liste.includes(titreId)) suivant.liste.push(titreId);
      break;
    default:
      break;
  }

  suivant.derniereProposition[titreId] = maintenant;
  return suivant;
}

/** Note l'exposition d'une liste de titres (ils viennent d'être affichés). */
export function enregistrerExpositions(
  historique            ,
  titreIds          ,
  maintenant         = Date.now(),
)             {
  const expositions = { ...historique.expositions };
  const derniereProposition = { ...historique.derniereProposition };
  for (const id of titreIds) {
    expositions[id] = (expositions[id] ?? 0) + 1;
    derniereProposition[id] = maintenant;
  }
  return { ...historique, expositions, derniereProposition };
}

/* ---------------------------------------------------------------------
   Construction du profil à partir du test de personnalité.
   --------------------------------------------------------------------- */

/** Les réponses brutes collectées par les 10 écrans du test. */
                               
                 
                         
                                                           
                         
                                
                         
                           
                                                                 
                   
                                                                                
                   
                             
                          
                                   
                                   
                       
                        
               
                     
                      
 

/** Poids initiaux posés par les déclarations explicites du test. */
const INIT = {
  genreAdore: 0.75,
  genreDeteste: -0.9,
  tonalitePreferee: 0.8,
  /** Amplitude d'un titre coché dans « mes 5 préférés ». */
  favori: 0.22,
  /** Amplitude d'un titre coché dans « mon enfance » (nostalgie déclarée). */
  enfance: 0.15,
}         ;

/**
 * Transforme les réponses du test en profil exploitable par le moteur.
 * C'est l'amorçage : le vecteur bougera ensuite à chaque interaction.
 */
export function construireProfilDepuisTest(reponses              )                    {
  let gouts = vecteurVide();

  // 1. Déclarations explicites de genres.
  gouts = { ...gouts, genres: ajouterPoidsListe(gouts.genres, reponses.genresAdores, INIT.genreAdore) };
  gouts = { ...gouts, genres: ajouterPoidsListe(gouts.genres, reponses.genresDetestes, INIT.genreDeteste) };

  // 2. Tonalité préférée.
  gouts = { ...gouts, tonalites: ajouterPoids(gouts.tonalites, reponses.tonalitePreferee, INIT.tonalitePreferee) };

  // 3. Les 5 titres préférés : le signal le plus riche du test.
  for (const titre of reponses.favoris) {
    gouts = deplacerVersTitre(gouts, titre, INIT.favori);
  }

  // 4. Les titres d'enfance : nostalgie, avec un accent sur leur décennie.
  for (const titre of reponses.enfance) {
    gouts = deplacerVersTitre(gouts, titre, INIT.enfance);
    gouts = { ...gouts, decennies: ajouterPoids(gouts.decennies, decennie(titre.annee), 0.1) };
  }

  // 5. Les genres détestés sont ré-appliqués en dernier : aucun titre
  //    préféré ne doit pouvoir « racheter » un genre explicitement rejeté.
  gouts = { ...gouts, genres: ajouterPoidsListe(gouts.genres, reponses.genresDetestes, INIT.genreDeteste) };

  return {
    pseudo: reponses.pseudo,
    anneeNaissance: reponses.anneeNaissance,
    genrePersonne: reponses.genrePersonne,
    typesSouhaites: reponses.typesSouhaites.length ? reponses.typesSouhaites : ['film', 'serie'],
    genresAdores: reponses.genresAdores,
    genresDetestes: reponses.genresDetestes,
    tonalitePreferee: reponses.tonalitePreferee,
    dureeMax: reponses.dureeMax,
    languePreferee: reponses.languePreferee,
    epoquePreferee: reponses.epoquePreferee,
    animationOk: reponses.animationOk,
    plateformes: reponses.plateformes,
    pays: reponses.pays || 'FR',
    gouts,
    aEviter: reponses.aEviter ?? [],
    interets: reponses.interets ?? [],
  };
}

/** Les N clés de plus fort poids d'une facette (sert aux explications). */
export function topFacette(carte                        , n        , minimum = 0.15)           {
  return Object.entries(carte)
    .filter(([, v]) => v >= minimum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}
