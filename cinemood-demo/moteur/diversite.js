/* Généré par scripts/construire-demo.mjs — NE PAS MODIFIER À LA MAIN.
   Source : cinemood/src/lib/reco/diversite.ts
   Les types TypeScript ont été retirés ; la logique est identique. */

/* =====================================================================
   diversite.ts — Re-classement MMR, quotas et pépites.
   ---------------------------------------------------------------------
   Sans ce module, un bon algorithme de scoring renvoie dix fois le même
   film. On y ajoute trois garde-fous :
     • MMR : on préfère un titre un peu moins bien noté s'il apporte
       quelque chose de différent ;
     • quotas : pas plus de N titres du même genre principal, un seul par
       réalisateur ;
     • pépites : 15 à 20 % de titres peu populaires mais compatibles.
   ===================================================================== */

import { DIVERSITE } from './poids.js';
                                                     

/** Un candidat en cours de classement. */
                           
               
                
                                                               
                   
                                                                  
                       
 

/** Similarité de Jaccard entre deux listes. */
export function jaccard(a          , b          )         {
  if (a.length === 0 && b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let intersection = 0;
  for (const x of sa) if (sb.has(x)) intersection += 1;
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Similarité entre deux titres, entre 0 et 1.
 * Les genres et les mots-clés pèsent le plus ; partager un réalisateur
 * ou une décennie rapproche aussi fortement deux propositions.
 */
export function similariteTitres(a       , b       )         {
  const genres = jaccard(a.genres, b.genres);
  const motsCles = jaccard(a.motsCles, b.motsCles);
  const realisateur = jaccard(a.realisateurs, b.realisateurs);
  const memeDecennie = Math.floor(a.annee / 10) === Math.floor(b.annee / 10) ? 1 : 0;
  const memeFranchise = memeRacineDeTitre(a.titre, b.titre) ? 1 : 0;

  return Math.min(
    1,
    0.42 * genres + 0.26 * motsCles + 0.14 * realisateur + 0.08 * memeDecennie + 0.4 * memeFranchise,
  );
}

/** Détecte grossièrement deux volets d'une même franchise. */
export function memeFranchise(a       , b       )          {
  return memeRacineDeTitre(a.titre, b.titre);
}

function memeRacineDeTitre(a        , b        )          {
  const racine = (s        ) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[:\-–(]/)[0]
      .trim();
  const ra = racine(a);
  const rb = racine(b);
  return ra.length > 3 && ra === rb;
}

/** Genre principal d'un titre (le premier listé par TMDB). */
export function genrePrincipal(titre       )         {
  return titre.genres[0] ?? 'Autre';
}

/**
 * Le genre sous lequel un titre est compté pour les quotas.
 *
 * Ce n'est pas toujours le premier de la liste : « Breaking Bad » est
 * classé Drame par TMDB, mais quelqu'un qui a coché « Crime » le reçoit
 * PARCE QUE c'est du crime. Le compter comme un drame faisait sauter le
 * quota des drames tout en ne créditant pas le genre réellement en jeu.
 */
export function genreDeReference(titre       , adores             )         {
  const adore = titre.genres.find((g) => adores.has(g));
  return adore ?? genrePrincipal(titre);
}

/**
 * Re-classement de type MMR (Maximal Marginal Relevance).
 *
 * À chaque tour on choisit le candidat qui maximise :
 *   λ · pertinence − (1 − λ) · similarité_max_avec_les_déjà_choisis
 *
 * Les quotas par genre principal et par réalisateur s'appliquent en plus,
 * avec une soupape : si les quotas bloquent tout, on les relâche plutôt
 * que de renvoyer une liste trop courte.
 */
export function reclasserMMR(
  candidats            ,
  taille        ,
  // Annotation explicite : `DIVERSITE` est figé par `as const`, sans quoi
  // le paramètre serait typé `0.72` et n'accepterait aucune autre valeur.
  lambda         = DIVERSITE.lambda,
  /** Genres explicitement adorés : ils bénéficient d'un quota plus large. */
  genresAdores           = [],
)             {
  const adores = new Set(genresAdores);
  const quotaDe = (genre        ) =>
    adores.has(genre) ? DIVERSITE.maxParGenreAdore : DIVERSITE.maxParGenrePrincipal;
  const genreDe = (t       ) => genreDeReference(t, adores);
  const restants = [...candidats].sort((a, b) => b.score - a.score);
  const choisis             = [];
  const compteurGenre                         = {};
  const compteurRealisateur                         = {};

  // Normalisation des scores pour que λ ait un sens comparable d'un
  // utilisateur à l'autre.
  const scores = restants.map((c) => c.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 1);
  const etendue = max - min || 1;
  const normalise = (s        ) => (s - min) / etendue;

  while (choisis.length < taille && restants.length > 0) {
    let meilleurIndex = -1;
    let meilleureValeur = -Infinity;
    let meilleurIndexHorsQuota = -1;
    let meilleureValeurHorsQuota = -Infinity;

    for (let i = 0; i < restants.length; i += 1) {
      const candidat = restants[i];
      const similariteMax = choisis.reduce(
        (acc, deja) => Math.max(acc, similariteTitres(candidat.titre, deja.titre)),
        0,
      );
      const valeur = lambda * normalise(candidat.score) - (1 - lambda) * similariteMax;

      if (valeur > meilleureValeurHorsQuota) {
        meilleureValeurHorsQuota = valeur;
        meilleurIndexHorsQuota = i;
      }

      if (!respecteQuotas(candidat, compteurGenre, compteurRealisateur, quotaDe, genreDe)) continue;

      if (valeur > meilleureValeur) {
        meilleureValeur = valeur;
        meilleurIndex = i;
      }
    }

    // Soupape : plutôt relâcher les quotas que rendre une liste trop courte.
    const index = meilleurIndex >= 0 ? meilleurIndex : meilleurIndexHorsQuota;
    if (index < 0) break;

    const [retenu] = restants.splice(index, 1);
    choisis.push(retenu);
    const g = genreDe(retenu.titre);
    compteurGenre[g] = (compteurGenre[g] ?? 0) + 1;
    for (const r of retenu.titre.realisateurs) {
      compteurRealisateur[r] = (compteurRealisateur[r] ?? 0) + 1;
    }
  }

  return choisis;
}

function respecteQuotas(
  candidat          ,
  compteurGenre                        ,
  compteurRealisateur                        ,
  quotaDe                            = () => DIVERSITE.maxParGenrePrincipal,
  genreDe                       = genrePrincipal,
)          {
  const g = genreDe(candidat.titre);
  if ((compteurGenre[g] ?? 0) >= quotaDe(g)) return false;
  for (const r of candidat.titre.realisateurs) {
    if ((compteurRealisateur[r] ?? 0) >= DIVERSITE.maxParRealisateur) return false;
  }
  return true;
}

/**
 * Seuil de popularité en dessous duquel un titre est « peu exposé ».
 *
 * Il est calculé sur le vivier du moment plutôt que fixé en dur : la
 * popularité TMDB n'a pas la même échelle selon les catalogues et les
 * régions. On prend le 35ᵉ centile, plafonné par `populariteMaxPepite`
 * pour qu'un catalogue entièrement mainstream ne produise pas de fausses
 * pépites.
 */
export function seuilPepite(vivier            )         {
  if (vivier.length === 0) return DIVERSITE.populariteMaxPepite;
  const populaires = vivier.map((c) => c.titre.popularite).sort((a, b) => a - b);
  const index = Math.floor(populaires.length * 0.35);
  return Math.min(DIVERSITE.populariteMaxPepite, populaires[Math.min(index, populaires.length - 1)]);
}

/**
 * `true` si le candidat est une « pépite » : peu exposé, mais compatible
 * avec le profil. Surprendre n'est pas déranger — d'où le seuil
 * d'affinité minimale.
 */
export function estPepite(candidat          , seuil         = DIVERSITE.populariteMaxPepite)          {
  return candidat.titre.popularite <= seuil && candidat.affinite >= DIVERSITE.affiniteMinPepite;
}

/**
 * Passe finale : garantit le quota par genre principal.
 *
 * Pourquoi elle existe. Le MMR applique déjà le quota, mais il dispose
 * d'une soupape (plutôt relâcher la règle que rendre une liste trop
 * courte) et l'injection de pépites passe APRÈS lui. Résultat : le quota
 * pouvait sauter sans que rien ne le signale — c'est exactement ce qu'un
 * test de validation a mis au jour (quatre drames sur dix).
 *
 * La règle garantie ici est précise, et vérifiable : un genre ne dépasse
 * le quota QUE si le vivier n'offre plus aucun titre d'un genre encore
 * sous quota. Autrement dit, on ne rend jamais une liste plus pauvre
 * pour faire joli, mais on ne laisse plus filer un déséquilibre évitable.
 */
export function respecterQuotaGenre(
  liste            ,
  vivier            ,
  genresAdores           = [],
)             {
  const adores = new Set(genresAdores);
  const quotaDe = (genre        ) =>
    adores.has(genre) ? DIVERSITE.maxParGenreAdore : DIVERSITE.maxParGenrePrincipal;
  const genreDe = (t       ) => genreDeReference(t, adores);

  const taille = liste.length;
  const dejaPris = new Set(liste.map((c) => c.titre.id));
  const compteur = new Map                ();
  const gardes             = [];
  const recales             = [];

  for (const candidat of liste) {
    const g = genreDe(candidat.titre);
    if ((compteur.get(g) ?? 0) < quotaDe(g)) {
      compteur.set(g, (compteur.get(g) ?? 0) + 1);
      gardes.push(candidat);
    } else {
      recales.push(candidat);
    }
  }

  if (recales.length === 0) return liste;

  // On complète avec les meilleurs titres d'un genre encore sous quota.
  const remplacants = vivier
    .filter((c) => !dejaPris.has(c.titre.id))
    .sort((a, b) => b.score - a.score);

  for (const candidat of remplacants) {
    if (gardes.length >= taille) break;
    const g = genreDe(candidat.titre);
    if ((compteur.get(g) ?? 0) >= quotaDe(g)) continue;
    compteur.set(g, (compteur.get(g) ?? 0) + 1);
    gardes.push(candidat);
    dejaPris.add(candidat.titre.id);
  }

  // Vivier épuisé : on réintègre les recalés plutôt que de rendre une
  // liste plus courte. C'est le seul cas où le quota est dépassé.
  for (const candidat of recales) {
    if (gardes.length >= taille) break;
    gardes.push(candidat);
  }

  return gardes;
}

/**
 * Ordre d'affichage final.
 *
 * Le MMR et les trois passes de réparation choisissent le bon ENSEMBLE
 * de titres, mais leur ordre de sortie n'a plus de sens pour un lecteur :
 * on peut se retrouver avec le meilleur titre en quatrième position. On
 * reclasse donc par score, en réinsérant les pépites à intervalles
 * réguliers — reléguées en fin de liste, elles ne seraient jamais vues.
 */
export function ordonnerPourAffichage(liste            , idsPepites             )             {
  const ordinaires = liste.filter((c) => !idsPepites.has(c.titre.id)).sort((a, b) => b.score - a.score);
  const pepites = liste.filter((c) => idsPepites.has(c.titre.id)).sort((a, b) => b.score - a.score);
  if (pepites.length === 0) return ordinaires;

  const resultat             = [];
  const pas = Math.max(2, Math.floor(liste.length / (pepites.length + 1)));
  let curseur = 0;
  for (let i = 0; i < ordinaires.length; i += 1) {
    resultat.push(ordinaires[i]);
    if (curseur < pepites.length && (i + 1) % pas === 0) {
      resultat.push(pepites[curseur]);
      curseur += 1;
    }
  }
  while (curseur < pepites.length) {
    resultat.push(pepites[curseur]);
    curseur += 1;
  }
  return resultat;
}

/**
 * Garantit qu'une part minimale de la sélection touche les genres que la
 * personne a déclaré aimer.
 *
 * On ne remplace jamais une pépite (elle est hors zone de confort par
 * construction) ni un titre déjà pertinent : seuls les « remplissages »
 * les moins bien notés cèdent leur place. Et si le vivier ne contient
 * pas assez de titres pertinents, on s'arrête là plutôt que de rendre
 * une liste plus courte.
 */
export function assurerPlancherPertinence(
  liste            ,
  vivier            ,
  genresAdores          ,
  idsPepites             ,
  part         = DIVERSITE.plancherPertinence,
)             {
  if (genresAdores.length === 0 || liste.length === 0) return liste;
  const adores = new Set(genresAdores);
  const pertinent = (c          ) => c.titre.genres.some((g) => adores.has(g));

  const dejaPris = new Set(liste.map((c) => c.titre.id));
  const disponibles = vivier
    .filter((c) => !dejaPris.has(c.titre.id) && pertinent(c))
    .sort((a, b) => b.score - a.score);

  const actuels = liste.filter(pertinent).length;
  const objectif = Math.min(
    Math.ceil(liste.length * part),
    actuels + disponibles.length,
  );
  let manquants = objectif - actuels;
  if (manquants <= 0) return liste;

  // Candidats au remplacement : le remplissage hors goûts, du moins bon
  // au meilleur. Les pépites sont intouchables.
  const remplacables = liste
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !pertinent(c) && !idsPepites.has(c.titre.id))
    .sort((a, b) => a.c.score - b.c.score);

  const resultat = [...liste];
  const genreDe = (t                   ) => genreDeReference(t, adores);
  const compteurRealisateur = new Map                ();
  const compteurGenre = new Map                ();
  for (const c of liste) {
    for (const r of c.titre.realisateurs) {
      compteurRealisateur.set(r, (compteurRealisateur.get(r) ?? 0) + 1);
    }
    const g = genreDe(c.titre);
    compteurGenre.set(g, (compteurGenre.get(g) ?? 0) + 1);
  }

  // Le plancher a le droit de dépasser le quota par genre — le goût
  // déclaré prime sur l'heuristique de diversité — mais pas au point de
  // rendre la liste monotone. Le plafond d'affichage est plus bas que le
  // plancher : on reste dans ses goûts, en variant à l'intérieur.
  const plafondGenre = Math.ceil(liste.length * DIVERSITE.plafondGenreAffichage);

  let curseur = 0;
  for (const { index } of remplacables) {
    if (manquants <= 0) break;
    // On garde les règles déjà acquises : un seul titre par réalisateur,
    // le plafond d'affichage par genre, et surtout pas deux volets de la
    // même franchise — un plancher ne doit jamais défaire une garantie.
    while (
      curseur < disponibles.length &&
      (disponibles[curseur].titre.realisateurs.some(
        (r) => (compteurRealisateur.get(r) ?? 0) >= DIVERSITE.maxParRealisateur,
      ) ||
        (compteurGenre.get(genreDe(disponibles[curseur].titre)) ?? 0) >= plafondGenre ||
        resultat.some((c, i) => i !== index && memeFranchise(c.titre, disponibles[curseur].titre)))
    ) {
      curseur += 1;
    }
    if (curseur >= disponibles.length) break;

    const entrant = disponibles[curseur];
    const sortant = resultat[index];
    for (const r of sortant.titre.realisateurs) {
      compteurRealisateur.set(r, Math.max(0, (compteurRealisateur.get(r) ?? 1) - 1));
    }
    for (const r of entrant.titre.realisateurs) {
      compteurRealisateur.set(r, (compteurRealisateur.get(r) ?? 0) + 1);
    }
    const gSortant = genreDe(sortant.titre);
    compteurGenre.set(gSortant, Math.max(0, (compteurGenre.get(gSortant) ?? 1) - 1));
    const gEntrant = genreDe(entrant.titre);
    compteurGenre.set(gEntrant, (compteurGenre.get(gEntrant) ?? 0) + 1);
    resultat[index] = entrant;
    curseur += 1;
    manquants -= 1;
  }

  return resultat;
}

/**
 * Garantit une part minimale de sorties récentes.
 *
 * Contrepoids indispensable au bonus de nostalgie. Un profil dont la
 * fenêtre de jeunesse est bien pourvue (années 90 sur Netflix, par
 * exemple) recevait dix titres de plus de quinze ans alors que son
 * vivier contenait six sorties récentes : le moteur l'enfermait dans
 * son passé, ce que le cahier des charges interdit explicitement.
 *
 * On ne sacrifie ni les pépites, ni — tant qu'on peut l'éviter — les
 * titres qui portent le plancher de pertinence.
 */
export function assurerPlancherActualite(
  liste            ,
  vivier            ,
  anneeCourante        ,
  fenetreAnnees        ,
  idsPepites             ,
  genresAdores          ,
  /** Sert à ne jamais sacrifier le dernier titre de la jeunesse. */
  estNostalgique                           = () => false,
  part         = DIVERSITE.plancherActualite,
)             {
  if (liste.length === 0) return liste;
  const recent = (c          ) => anneeCourante - c.titre.annee <= fenetreAnnees;

  const dejaPris = new Set(liste.map((c) => c.titre.id));
  const disponibles = vivier
    .filter((c) => !dejaPris.has(c.titre.id) && recent(c))
    .sort((a, b) => b.score - a.score);

  const actuels = liste.filter(recent).length;
  const objectif = Math.min(Math.ceil(liste.length * part), actuels + disponibles.length);
  let manquants = objectif - actuels;
  if (manquants <= 0) return liste;

  const adores = new Set(genresAdores);
  const pertinent = (c          ) => c.titre.genres.some((g) => adores.has(g));
  const genreDe = (c          ) => genreDeReference(c.titre, adores);
  const quotaDe = (genre        ) =>
    adores.has(genre) ? DIVERSITE.maxParGenreAdore : DIVERSITE.maxParGenrePrincipal;

  // Même précaution que pour les pépites : une nouveauté ne doit pas
  // faire sauter le quota de genre au passage.
  const compteurGenre = new Map                ();
  for (const c of liste) {
    const g = genreDe(c);
    compteurGenre.set(g, (compteurGenre.get(g) ?? 0) + 1);
  }

  // Ordre de sacrifice : d'abord les anciens hors goûts, puis, seulement
  // si nécessaire, les anciens pertinents. Jamais les pépites.
  // Garde-fou : on ne vide jamais complètement la nostalgie pour faire
  // de la place à l'actualité. Les deux exigences sont symétriques, ni
  // l'une ni l'autre ne doit écraser l'autre.
  const nostalgiques = liste.filter(estNostalgique);
  const nostalgieProtegee = new Set(
    nostalgiques.length <= 1 ? nostalgiques.map((c) => c.titre.id) : [],
  );

  const remplacables = liste
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !recent(c) && !idsPepites.has(c.titre.id) && !nostalgieProtegee.has(c.titre.id))
    .sort((a, b) => {
      const priorite = Number(pertinent(a.c)) - Number(pertinent(b.c));
      return priorite !== 0 ? priorite : a.c.score - b.c.score;
    });

  const resultat = [...liste];
  let curseur = 0;
  for (const { index } of remplacables) {
    if (manquants <= 0) break;

    // On saute les nouveautés qui feraient déborder un quota de genre,
    // ou qui doubleraient une franchise déjà présente.
    while (curseur < disponibles.length) {
      const g = genreDe(disponibles[curseur]);
      const gSortant = genreDe(resultat[index]);
      const apresRetrait = g === gSortant ? (compteurGenre.get(g) ?? 0) - 1 : (compteurGenre.get(g) ?? 0);
      const doublonFranchise = resultat.some(
        (c, i) => i !== index && memeFranchise(c.titre, disponibles[curseur].titre),
      );
      if (apresRetrait < quotaDe(g) && !doublonFranchise) break;
      curseur += 1;
    }
    if (curseur >= disponibles.length) break;

    const entrant = disponibles[curseur];
    const gSortant = genreDe(resultat[index]);
    compteurGenre.set(gSortant, Math.max(0, (compteurGenre.get(gSortant) ?? 1) - 1));
    const gEntrant = genreDe(entrant);
    compteurGenre.set(gEntrant, (compteurGenre.get(gEntrant) ?? 0) + 1);

    resultat[index] = entrant;
    curseur += 1;
    manquants -= 1;
  }
  return resultat;
}

/**
 * Insère la part convenue de pépites dans une sélection déjà classée.
 * Les pépites remplacent les positions les plus basses, et sont
 * réparties dans la liste plutôt que reléguées à la fin.
 *
 * `idsPepites` ne contient QUE les titres injectés volontairement : ce
 * sont eux qui portent le badge « Pépite » dans l'interface. Les titres
 * peu exposés déjà remontés naturellement par le score comptent dans
 * l'objectif — la liste est déjà ouverte, inutile d'en rajouter — mais
 * ils ne sont pas badgés : ils ont gagné leur place à la loyale.
 */
export function injecterPepites(
  selection            ,
  reserve            ,
  taille        ,
  part         = DIVERSITE.partPepites,
)                                                 {
  const objectif = Math.round(taille * part);
  const seuil = seuilPepite(reserve);
  const dejaLa = new Set(selection.map((c) => c.titre.id));
  const idsPepites = new Set        ();

  const pepitesDisponibles = reserve
    .filter((c) => !dejaLa.has(c.titre.id) && estPepite(c, seuil))
    .sort((a, b) => b.score - a.score);

  // Les pépites déjà présentes naturellement comptent dans l'objectif.
  const dejaPepites = selection.slice(0, taille).filter((c) => estPepite(c, seuil));
  const manquantes = Math.max(0, objectif - dejaPepites.length);
  if (manquantes === 0 || pepitesDisponibles.length === 0) {
    return { liste: selection.slice(0, taille), idsPepites };
  }

  const liste = selection.slice(0, taille);
  const aInserer = pepitesDisponibles.slice(0, manquantes);

  // On écrase les dernières positions, puis on redistribue les pépites à
  // intervalles réguliers pour qu'elles se voient.
  const gardees = liste.slice(0, Math.max(0, liste.length - aInserer.length));
  const fusion             = [];
  const pas = Math.max(2, Math.floor((gardees.length + aInserer.length) / (aInserer.length + 1)));
  let curseurPepite = 0;

  for (let i = 0; i < gardees.length; i += 1) {
    fusion.push(gardees[i]);
    if (curseurPepite < aInserer.length && (i + 1) % pas === 0) {
      const p = aInserer[curseurPepite];
      fusion.push(p);
      idsPepites.add(p.titre.id);
      curseurPepite += 1;
    }
  }
  while (curseurPepite < aInserer.length) {
    const p = aInserer[curseurPepite];
    fusion.push(p);
    idsPepites.add(p.titre.id);
    curseurPepite += 1;
  }

  return { liste: fusion.slice(0, taille), idsPepites };
}
