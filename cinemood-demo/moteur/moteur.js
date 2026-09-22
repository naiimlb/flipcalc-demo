/* Généré par scripts/construire-demo.mjs — NE PAS MODIFIER À LA MAIN.
   Source : cinemood/src/lib/reco/moteur.ts
   Les types TypeScript ont été retirés ; la logique est identique. */

/* =====================================================================
   moteur.ts — Orchestration complète d'une session de recommandation.
   ---------------------------------------------------------------------
   Enchaînement :
     1. filtrage STRICT (plateformes, âge, type, animation) ;
     2. scoring de chaque candidat ;
     3. re-classement MMR + quotas de diversité ;
     4. injection des pépites ;
     5. génération de la phrase « Pourquoi pour toi ».
   ===================================================================== */

import {
  autoriseParAge,
  age as calculerAge,
  classificationMaximale,
  estNostalgique,
} from './epoque.js';
import { genererPourquoi } from './explication.js';
import {
  assurerPlancherActualite,
  assurerPlancherPertinence,
  injecterPepites,
  ordonnerPourAffichage,
  reclasserMMR,
  respecterQuotaGenre,
} from './diversite.js';
                                               
import { plateformesEffectives } from './plateformes.js';
import { EPOQUE, TABLE_COMPAGNIE } from './poids.js';
import { affiniteGouts, scorerTitre } from './score.js';
                                                                                                 

                                        
                                                                            
                  
                                                                     
                         
                                                                     
                        
 

/** Motifs possibles d'un écran vide, pour proposer la bonne action. */
                                                                                                

/** Une contrainte qui étrangle la sélection, et ce qu'elle coûte. */
                                      
                                                                             
                                                                                                           
                                 
                  
                                                                    
               
 

                                         
                                    
                                                         
                           
                                              
                         
                         
     
                                                                   
                                                                     
                                                                    
                   
     
                                               
 

/**
 * Identifie ce qui étrangle la sélection, en relâchant une contrainte à
 * la fois et en mesurant ce que cela débloquerait. On ne devine pas :
 * on mesure.
 */
export function contraintesLimitantes(
  catalogue         ,
  profil                   ,
  historique            ,
  contexte          ,
  anneeCourante        ,
)                        {
  const reference = filtrerStrict(catalogue, profil, historique, contexte, anneeCourante).length;

  const essais                                                                                                             = [
    {
      cle: 'plateformes',
      libelle: 'Ajouter une plateforme',
      profil: { ...profil, plateformes: [] },
      contexte,
    },
    {
      cle: 'genres_detestes',
      libelle: `Rouvrir un des genres que tu évites (${profil.genresDetestes.join(', ')})`,
      profil: { ...profil, genresDetestes: [] },
      contexte,
    },
    { cle: 'animation', libelle: 'Accepter l’animation', profil: { ...profil, animationOk: true }, contexte },
    { cle: 'duree', libelle: 'Lever la durée maximale', profil: { ...profil, dureeMax: null }, contexte },
    { cle: 'types', libelle: 'Accepter films ET séries', profil: { ...profil, typesSouhaites: ['film', 'serie'] }, contexte },
    {
      cle: 'sujets_evites',
      libelle: 'Retirer un sujet de ta liste « à éviter »',
      profil: { ...profil, aEviter: [] },
      contexte,
    },
    { cle: 'compagnie', libelle: 'Regarder seul plutôt qu’en famille', profil, contexte: { ...contexte, compagnie: 'seul' } },
  ];

  return essais
    .map(({ cle, libelle, profil: p, contexte: c }) => ({
      cle,
      libelle,
      gain: filtrerStrict(catalogue, p, historique, c, anneeCourante).length - reference,
    }))
    .filter((x) => x.gain > 0)
    .sort((a, b) => b.gain - a.gain);
}

/* ---------------------------------------------------------------------
   1. Filtrage strict — ces règles ne sont JAMAIS contournées.
   --------------------------------------------------------------------- */

/**
 * Les exclusions dures. Aucune de ces règles n'est négociable, et
 * aucune n'est exprimée en pénalité : un titre qui tombe ici ne peut
 * pas revenir dans la sélection, quel que soit son score par ailleurs.
 *
 * L'historique entre ici — et non plus seulement dans les pénalités —
 * parce qu'un titre déjà vu ou explicitement refusé ne doit JAMAIS
 * reparaître, pas seulement être désavantagé.
 */
export function filtrerStrict(
  catalogue         ,
  profil                   ,
  historique            ,
  contexte          ,
  anneeCourante        ,
)          {
  const autorisees = new Set(plateformesEffectives(profil.plateformes));
  const ageUtilisateur = calculerAge(profil.anneeNaissance, anneeCourante);
  const plafondCompagnie = TABLE_COMPAGNIE[contexte.compagnie]?.classificationMax ?? null;
  const plafond = classificationMaximale(ageUtilisateur, plafondCompagnie);
  const plafondAge = ageMinimumDe(plafond);
  const detestes = new Set(profil.genresDetestes);
  const refuses = new Set(historique.refuses);
  const aEviter = profil.aEviter
    .map((sujet) => sujet.trim().toLowerCase())
    .filter((sujet) => sujet.length > 2);

  return catalogue.filter((titre) => {
    // a. Disponibilité sur au moins une plateforme de la personne.
    if (!titre.plateformes.some((p) => autorisees.has(p))) return false;

    // b. Classification d'âge : âge réel ET contrainte de compagnie.
    if (!autoriseParAge(titre, ageUtilisateur)) return false;
    if (!autoriseParAge(titre, plafondAge)) return false;

    // c. Type de contenu souhaité (films, séries, ou les deux).
    if (!profil.typesSouhaites.includes(titre.type)) return false;

    // d. Animation refusée au test.
    if (!profil.animationOk && titre.animation) return false;

    // e. Genre explicitement détesté : exclusion, pas pénalité. Quelqu'un
    //    qui déclare ne pas supporter l'horreur ne doit pas en voir, même
    //    si le titre coche toutes les autres cases.
    if (titre.genres.some((g) => detestes.has(g))) return false;

    // f. Déjà vu, ou refusé d'un « pas pour moi » : on ne le repropose pas.
    if (historique.vus[titre.id] !== undefined) return false;
    if (refuses.has(titre.id)) return false;

    // g. Sujet que la personne a demandé de ne jamais croiser.
    if (aEviter.length > 0) {
      const corpus = [...titre.motsCles, ...titre.genres].map((x) => x.toLowerCase());
      if (aEviter.some((sujet) => corpus.some((mot) => mot.includes(sujet)))) return false;
    }

    return true;
  });
}

/** Âge minimum associé à une classification, sans réimporter la table. */
function ageMinimumDe(classification        )         {
  const table                         = { TP: 0, '10': 10, '12': 12, '16': 16, '18': 18 };
  return table[classification] ?? 18;
}

/* ---------------------------------------------------------------------
   2. Point d'entrée principal.
   --------------------------------------------------------------------- */

export function recommander(
  catalogue         ,
  profil                   ,
  historique            ,
  contexte          ,
  options                        = {},
)                         {
  const taille = Math.max(1, Math.min(20, options.taille ?? 15));
  const anneeCourante = options.anneeCourante ?? new Date(contexte.maintenant).getFullYear();

  if (catalogue.length === 0) {
    return {
      recommandations: [],
      candidatsRetenus: 0,
      catalogueTotal: 0,
      raisonVide: 'catalogue_vide',
      contraintesLimitantes: [],
    };
  }

  // Le catalogue porte-t-il des bandes-annonces ? En mode démo, non :
  // la pénalité correspondante serait alors universelle, donc inutile.
  const avecBandesAnnonces = catalogue.some((t) => t.bandeAnnonce !== null);

  // --- Étape 1 : filtrage strict --------------------------------------
  const eligibles = filtrerStrict(catalogue, profil, historique, contexte, anneeCourante);
  if (eligibles.length === 0) {
    return {
      recommandations: [],
      candidatsRetenus: 0,
      catalogueTotal: catalogue.length,
      raisonVide: profil.plateformes.length === 0 ? 'aucune_plateforme' : 'filtres_trop_stricts',
      contraintesLimitantes: contraintesLimitantes(catalogue, profil, historique, contexte, anneeCourante),
    };
  }

  // --- Étape 2 : scoring ----------------------------------------------
  const candidats             = eligibles.map((titre) => {
    const { score, detail } = scorerTitre(titre, profil, historique, contexte, anneeCourante, {
      penaliserSansBandeAnnonce: avecBandesAnnonces,
    });
    return { titre, score, affinite: detail.gouts, detail };
  });

  // Les titres lourdement pénalisés (refusés, détestés, déjà mal notés)
  // sortent de la course : inutile de les faire concourir.
  const enCourse = candidats.filter((c) => c.score > 0);
  const base = enCourse.length >= taille ? enCourse : candidats;

  // --- Étape 3 : re-classement MMR ------------------------------------
  // On classe large (3× la taille) pour laisser de la matière aux pépites.
  const selection = reclasserMMR(base, Math.min(base.length, taille * 3), undefined, profil.genresAdores);

  // --- Étape 4 : pépites ----------------------------------------------
  const { liste: avecPepites, idsPepites } = injecterPepites(selection, base, taille);

  // --- Étape 4 bis : garantie finale de diversité ----------------------
  // Le MMR et l'injection de pépites peuvent, chacun de leur côté, laisser
  // filer le quota par genre. On le rétablit ici, une fois pour toutes.
  const apresQuota = respecterQuotaGenre(avecPepites, base, profil.genresAdores);

  // --- Étape 4 ter : plancher de pertinence ----------------------------
  // La diversité ne doit pas évincer le goût déclaré : au moins 70 % de
  // la liste touche un genre que la personne a coché.
  const apresPertinence = assurerPlancherPertinence(apresQuota, base, profil.genresAdores, idsPepites);

  // --- Étape 4 quater : plancher d'actualité ---------------------------
  // Le pendant du bonus de nostalgie : on ne laisse personne enfermé
  // dans sa propre décennie quand le catalogue offre mieux.
  const apresActualite = assurerPlancherActualite(
    apresPertinence,
    base,
    anneeCourante,
    EPOQUE.fenetreNouveautesAnnees,
    idsPepites,
    profil.genresAdores,
    (c) => estNostalgique(c.titre, profil),
  );

  // --- Étape 4 quinquies : ordre d'affichage ---------------------------
  const liste = ordonnerPourAffichage(apresActualite, idsPepites);

  // --- Étape 5 : explications -----------------------------------------
  const recommandations                   = liste.map((c, rang) => {
    // `detail` est toujours présent : il est posé à l'étape 2 et traverse
    // le MMR et l'injection de pépites sans être perdu.
    const detail = c.detail                            ;
    const pepite = idsPepites.has(c.titre.id);
    return {
      titre: c.titre,
      score: c.score,
      detail,
      pepite,
      bandeAnnonceDisponible: c.titre.bandeAnnonce !== null,
      pourquoi: genererPourquoi(c.titre, detail, profil, contexte, {
        titresAimes: options.titresAimes,
        pepite,
        anneeCourante,
        variante: rang,
      }),
    };
  });

  return {
    recommandations,
    candidatsRetenus: eligibles.length,
    catalogueTotal: catalogue.length,
    raisonVide: recommandations.length === 0 ? 'filtres_trop_stricts' : null,
    // Sélection plus courte que demandé : on dit pourquoi, et quoi faire.
    contraintesLimitantes:
      recommandations.length < taille
        ? contraintesLimitantes(catalogue, profil, historique, contexte, anneeCourante)
        : [],
  };
}

/**
 * Variante « Découvrir » : même scoring, mais sans humeur ni pépites,
 * pour trier des résultats de recherche ou de filtres.
 */
export function classerPourDecouverte(
  catalogue         ,
  profil                   ,
  historique            ,
  contexte          ,
  anneeCourante         = new Date().getFullYear(),
)                   {
  const sansHumeur           = { ...contexte, humeur: null };
  const eligibles = filtrerStrict(catalogue, profil, historique, sansHumeur, anneeCourante);
  return eligibles
    .map((titre) => {
      const { score, detail } = scorerTitre(titre, profil, historique, sansHumeur, anneeCourante);
      return {
        titre,
        score,
        detail,
        pepite: false,
        bandeAnnonceDisponible: titre.bandeAnnonce !== null,
        pourquoi: genererPourquoi(titre, detail, profil, sansHumeur, { anneeCourante }),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Affinité brute d'un titre : utilisée par l'écran « Ma liste ». */
export function affiniteBrute(titre       , profil                   )         {
  return affiniteGouts(titre, profil).score;
}
