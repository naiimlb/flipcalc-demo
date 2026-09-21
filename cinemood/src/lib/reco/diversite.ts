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

import { DIVERSITE } from './poids.ts';
import type { DetailScore, Titre } from './types.ts';

/** Un candidat en cours de classement. */
export interface Candidat {
  titre: Titre;
  score: number;
  /** Affinité pure (0-1), utilisée pour valider une pépite. */
  affinite: number;
  /** Détail du score, transporté jusqu'à l'explication finale. */
  detail?: DetailScore;
}

/** Similarité de Jaccard entre deux listes. */
export function jaccard(a: string[], b: string[]): number {
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
export function similariteTitres(a: Titre, b: Titre): number {
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
function memeRacineDeTitre(a: string, b: string): boolean {
  const racine = (s: string) =>
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
export function genrePrincipal(titre: Titre): string {
  return titre.genres[0] ?? 'Autre';
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
export function reclasserMMR(candidats: Candidat[], taille: number, lambda = DIVERSITE.lambda): Candidat[] {
  const restants = [...candidats].sort((a, b) => b.score - a.score);
  const choisis: Candidat[] = [];
  const compteurGenre: Record<string, number> = {};
  const compteurRealisateur: Record<string, number> = {};

  // Normalisation des scores pour que λ ait un sens comparable d'un
  // utilisateur à l'autre.
  const scores = restants.map((c) => c.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 1);
  const etendue = max - min || 1;
  const normalise = (s: number) => (s - min) / etendue;

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

      if (!respecteQuotas(candidat, compteurGenre, compteurRealisateur)) continue;

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
    const g = genrePrincipal(retenu.titre);
    compteurGenre[g] = (compteurGenre[g] ?? 0) + 1;
    for (const r of retenu.titre.realisateurs) {
      compteurRealisateur[r] = (compteurRealisateur[r] ?? 0) + 1;
    }
  }

  return choisis;
}

function respecteQuotas(
  candidat: Candidat,
  compteurGenre: Record<string, number>,
  compteurRealisateur: Record<string, number>,
): boolean {
  const g = genrePrincipal(candidat.titre);
  if ((compteurGenre[g] ?? 0) >= DIVERSITE.maxParGenrePrincipal) return false;
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
export function seuilPepite(vivier: Candidat[]): number {
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
export function estPepite(candidat: Candidat, seuil: number = DIVERSITE.populariteMaxPepite): boolean {
  return candidat.titre.popularite <= seuil && candidat.affinite >= DIVERSITE.affiniteMinPepite;
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
  selection: Candidat[],
  reserve: Candidat[],
  taille: number,
  part = DIVERSITE.partPepites,
): { liste: Candidat[]; idsPepites: Set<string> } {
  const objectif = Math.round(taille * part);
  const seuil = seuilPepite(reserve);
  const dejaLa = new Set(selection.map((c) => c.titre.id));
  const idsPepites = new Set<string>();

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
  const fusion: Candidat[] = [];
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
