/* =====================================================================
   score.ts — Le calcul du score d'un titre pour un utilisateur donné.
   ---------------------------------------------------------------------
   score = affinité goûts + bonus époque + correspondance humeur
         + qualité + fraîcheur − pénalités
   Chaque terme est ramené entre 0 et 1 avant d'être pondéré par
   `POIDS_SCORE`, ce qui rend les réglages de `poids.ts` intuitifs.
   ===================================================================== */

import { dureeEffective, scoreHumeur } from './humeur.ts';
import { bonusEpoque } from './epoque.ts';
import { decennie } from './profil.ts';
import {
  FENETRE_ROTATION_MS,
  FRAICHEUR,
  PENALITES,
  POIDS_FACETTES,
  POIDS_SCORE,
  QUALITE,
} from './poids.ts';
import type { Contexte, DetailScore, Historique, ProfilUtilisateur, Titre } from './types.ts';

/* ---------------------------------------------------------------------
   1. Affinité avec le vecteur de goûts.
   --------------------------------------------------------------------- */

/**
 * Deux façons de lire une facette :
 *   • « dense » : les clés absentes du vecteur comptent comme neutres
 *     (peu de valeurs possibles — genres, tonalités, décennies) ;
 *   • « creuse » : seules les clés connues comptent, et si aucune n'est
 *     connue la facette est ignorée (beaucoup de valeurs possibles —
 *     mots-clés, réalisateurs, acteurs, pays). Un titre n'est jamais
 *     pénalisé parce qu'on ne connaît pas encore son casting.
 */
type ModeFacette = 'dense' | 'creuse';

/** Moyenne des poids d'une facette, ou `null` si la facette est muette. */
export function affiniteFacette(
  cles: string[],
  carte: Record<string, number>,
  mode: ModeFacette,
): number | null {
  if (cles.length === 0) return null;
  if (mode === 'dense') {
    const somme = cles.reduce((acc, cle) => acc + (carte[cle] ?? 0), 0);
    return somme / cles.length;
  }
  const connues = cles.filter((cle) => carte[cle] !== undefined);
  if (connues.length === 0) return null;
  const somme = connues.reduce((acc, cle) => acc + carte[cle], 0);
  // Une seule correspondance forte suffit à tirer la facette vers le haut.
  return somme / Math.min(connues.length, 2);
}

/** Ramène un poids de [-1, 1] vers [0, 1]. */
function versUnite(x: number): number {
  return Math.max(0, Math.min(1, (x + 1) / 2));
}

/**
 * Affinité globale, entre 0 et 1, plus le détail des facettes qui ont le
 * plus contribué (utilisé par la phrase « Pourquoi pour toi »).
 */
export function affiniteGouts(
  titre: Titre,
  profil: ProfilUtilisateur,
): { score: number; contributions: Array<{ facette: string; valeur: number; libelle: string }> } {
  const g = profil.gouts;
  const mesures: Array<{ facette: string; poids: number; brut: number | null; libelle: string }> = [
    {
      facette: 'genres',
      poids: POIDS_FACETTES.genres,
      brut: affiniteFacette(titre.genres, g.genres, 'dense'),
      libelle: meilleureCle(titre.genres, g.genres),
    },
    {
      facette: 'motsCles',
      poids: POIDS_FACETTES.motsCles,
      brut: affiniteFacette(titre.motsCles, g.motsCles, 'creuse'),
      libelle: meilleureCle(titre.motsCles, g.motsCles),
    },
    {
      facette: 'realisateurs',
      poids: POIDS_FACETTES.realisateurs,
      brut: affiniteFacette(titre.realisateurs, g.realisateurs, 'creuse'),
      libelle: meilleureCle(titre.realisateurs, g.realisateurs),
    },
    {
      facette: 'acteurs',
      poids: POIDS_FACETTES.acteurs,
      brut: affiniteFacette(titre.acteurs, g.acteurs, 'creuse'),
      libelle: meilleureCle(titre.acteurs, g.acteurs),
    },
    {
      facette: 'tonalites',
      poids: POIDS_FACETTES.tonalites,
      brut: affiniteFacette(titre.tonalites, g.tonalites, 'dense'),
      libelle: meilleureCle(titre.tonalites, g.tonalites),
    },
    {
      facette: 'decennies',
      poids: POIDS_FACETTES.decennies,
      brut: affiniteFacette([decennie(titre.annee)], g.decennies, 'dense'),
      libelle: `années ${decennie(titre.annee)}`,
    },
    {
      facette: 'pays',
      poids: POIDS_FACETTES.pays,
      brut: affiniteFacette(titre.pays, g.pays, 'creuse'),
      libelle: meilleureCle(titre.pays, g.pays),
    },
  ];

  let sommePonderee = 0;
  let sommePoids = 0;
  const contributions: Array<{ facette: string; valeur: number; libelle: string }> = [];

  for (const m of mesures) {
    if (m.brut === null) continue;
    sommePonderee += versUnite(m.brut) * m.poids;
    sommePoids += m.poids;
    if (m.brut > 0.1 && m.libelle) {
      contributions.push({ facette: m.facette, valeur: m.brut * m.poids, libelle: m.libelle });
    }
  }

  // Aucune facette exploitable : score neutre, la découverte fera le reste.
  const score = sommePoids === 0 ? 0.5 : sommePonderee / sommePoids;
  contributions.sort((a, b) => b.valeur - a.valeur);
  return { score, contributions };
}

/** La clé du titre la mieux notée dans le vecteur (pour l'explication). */
function meilleureCle(cles: string[], carte: Record<string, number>): string {
  let meilleure = '';
  let max = -Infinity;
  for (const cle of cles) {
    const v = carte[cle] ?? 0;
    if (v > max) {
      max = v;
      meilleure = cle;
    }
  }
  return max > 0 ? meilleure : (cles[0] ?? '');
}

/* ---------------------------------------------------------------------
   2. Qualité : note TMDB amortie par le nombre de votes.
   --------------------------------------------------------------------- */

/**
 * Moyenne bayésienne : un 9,5/10 sur 12 votes ne doit pas battre un
 * 8,2/10 sur 30 000 votes.
 */
export function scoreQualite(titre: Titre): number {
  const { votesCredibles, notePrior, notePlancher } = QUALITE;
  const v = Math.max(0, titre.nbVotes);
  const noteAmortie = (v * titre.note + votesCredibles * notePrior) / (v + votesCredibles);
  return Math.max(0, Math.min(1, (noteAmortie - notePlancher) / (10 - notePlancher)));
}

/* ---------------------------------------------------------------------
   3. Fraîcheur : récence + tendance.
   --------------------------------------------------------------------- */

export function scoreFraicheur(titre: Titre, anneeCourante: number): number {
  const anciennete = Math.max(0, anneeCourante - titre.annee);
  const recence = Math.pow(0.5, anciennete / FRAICHEUR.demiVieAnnees);
  const tendance = Math.max(0, Math.min(1, titre.popularite / 100));
  return (1 - FRAICHEUR.partPopularite) * recence + FRAICHEUR.partPopularite * tendance;
}

/* ---------------------------------------------------------------------
   4. Pénalités.
   --------------------------------------------------------------------- */

export function calculerPenalites(
  titre: Titre,
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
): number {
  let total = 0;

  // Déjà vu, noté.
  const vu = historique.vus[titre.id];
  if (vu === 1) total += PENALITES.dejaVuAime;
  if (vu === -1) total += PENALITES.dejaVuPasAime;

  // Refusé explicitement.
  if (historique.refuses.includes(titre.id)) total += PENALITES.refuse;

  // Déjà dans « Ma liste » : on ne le remet pas en avant.
  if (historique.liste.includes(titre.id)) total += PENALITES.dansLaListe;

  // Genres détestés.
  const detestes = titre.genres.filter((g) => profil.genresDetestes.includes(g)).length;
  total += detestes * PENALITES.parGenreDeteste;

  // Sur-exposition : proposé encore et encore.
  const expositions = historique.expositions[titre.id] ?? 0;
  total += Math.min(PENALITES.expositionMax, expositions * PENALITES.parExposition);

  // Rotation : proposé il y a moins d'une semaine.
  const derniere = historique.derniereProposition[titre.id];
  if (derniere !== undefined && contexte.maintenant - derniere < FENETRE_ROTATION_MS) {
    total += PENALITES.rotationRecente;
  }

  // Durée au-delà de ce que la personne a déclaré supporter.
  if (profil.dureeMax !== null) {
    const trop = dureeEffective(titre) - profil.dureeMax;
    if (trop > 0) total += (trop / 30) * PENALITES.parTranche30minDeTrop;
  }

  // Langue d'origine : préférence VO/VF.
  if (profil.languePreferee === 'vf' && titre.langueOriginale !== 'fr') {
    total += PENALITES.languePreferee;
  }

  // Sujets que la personne a demandé d'éviter.
  if (profil.aEviter.length > 0) {
    const corpus = [...titre.motsCles, ...titre.genres].map((x) => x.toLowerCase());
    const touche = profil.aEviter.some((sujet) => {
      const s = sujet.trim().toLowerCase();
      return s.length > 2 && corpus.some((mot) => mot.includes(s));
    });
    if (touche) total += PENALITES.sujetAEviter;
  }

  return total;
}

/* ---------------------------------------------------------------------
   5. Score final.
   --------------------------------------------------------------------- */

export function scorerTitre(
  titre: Titre,
  profil: ProfilUtilisateur,
  historique: Historique,
  contexte: Contexte,
  anneeCourante: number,
): { score: number; detail: DetailScore } {
  const { score: gouts, contributions } = affiniteGouts(titre, profil);
  const epoque = bonusEpoque(titre, profil, anneeCourante);
  const humeur = scoreHumeur(titre, contexte);
  const qualite = scoreQualite(titre);
  const fraicheur = scoreFraicheur(titre, anneeCourante);
  const penalites = calculerPenalites(titre, profil, historique, contexte);

  const brut =
    POIDS_SCORE.gouts * gouts +
    POIDS_SCORE.epoque * epoque +
    POIDS_SCORE.humeur * humeur +
    POIDS_SCORE.qualite * qualite +
    POIDS_SCORE.fraicheur * fraicheur;

  return {
    score: brut - penalites,
    detail: { gouts, epoque, humeur, qualite, fraicheur, penalites, contributions },
  };
}
