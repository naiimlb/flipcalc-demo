/* =====================================================================
   validation.ts — Contrôle des données reçues par les routes d'API.
   ---------------------------------------------------------------------
   Les routes reçoivent le profil depuis le navigateur. Même s'il s'agit
   des données de la personne elle-même, on ne fait jamais confiance à un
   corps de requête : un champ manquant ou d'un mauvais type doit donner
   une erreur claire, pas un plantage à 500.
   ===================================================================== */

import type { Contexte, Historique, ProfilUtilisateur, VecteurGouts } from '@/lib/reco/types';

const TONALITES = ['leger', 'intense', 'emouvant', 'reflechi', 'flippant'];
const HUMEURS = [
  'fatigue', 'joyeux', 'triste', 'adrenaline', 'rire',
  'romantique', 'reflexion', 'evasion', 'frisson',
];
const COMPAGNIES = ['seul', 'couple', 'potes', 'famille'];

function texte(valeur: unknown, defaut = ''): string {
  return typeof valeur === 'string' ? valeur : defaut;
}

function listeDeTextes(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((x): x is string => typeof x === 'string').slice(0, 60);
}

function nombre(valeur: unknown, defaut: number, min: number, max: number): number {
  const n = typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : defaut;
  return Math.max(min, Math.min(max, n));
}

function carteDePoids(valeur: unknown): Record<string, number> {
  if (!valeur || typeof valeur !== 'object') return {};
  const resultat: Record<string, number> = {};
  let compte = 0;
  for (const [cle, poids] of Object.entries(valeur as Record<string, unknown>)) {
    if (compte >= 400) break; // garde-fou contre un profil anormalement gros
    if (typeof poids === 'number' && Number.isFinite(poids)) {
      resultat[cle.slice(0, 80)] = Math.max(-1, Math.min(1, poids));
      compte += 1;
    }
  }
  return resultat;
}

function vecteurGouts(valeur: unknown): VecteurGouts {
  const brut = (valeur ?? {}) as Record<string, unknown>;
  // Chaque facette est reconstruite : une facette absente devient une
  // carte vide, ce que le moteur sait traiter (facette « muette »).
  return {
    genres: carteDePoids(brut.genres),
    motsCles: carteDePoids(brut.motsCles),
    realisateurs: carteDePoids(brut.realisateurs),
    acteurs: carteDePoids(brut.acteurs),
    pays: carteDePoids(brut.pays),
    decennies: carteDePoids(brut.decennies),
    tonalites: carteDePoids(brut.tonalites),
  };
}

/** Normalise un profil reçu du navigateur. Ne lève jamais d'exception. */
export function profilValide(valeur: unknown): ProfilUtilisateur {
  const brut = (valeur ?? {}) as Record<string, unknown>;
  const anneeCourante = new Date().getFullYear();
  const types = listeDeTextes(brut.typesSouhaites).filter((t) => t === 'film' || t === 'serie');

  return {
    pseudo: texte(brut.pseudo).slice(0, 40),
    anneeNaissance: nombre(brut.anneeNaissance, anneeCourante - 30, 1900, anneeCourante),
    genrePersonne: typeof brut.genrePersonne === 'string' ? brut.genrePersonne.slice(0, 30) : undefined,
    typesSouhaites: (types.length ? types : ['film', 'serie']) as ProfilUtilisateur['typesSouhaites'],
    genresAdores: listeDeTextes(brut.genresAdores),
    genresDetestes: listeDeTextes(brut.genresDetestes),
    tonalitePreferee: (TONALITES.includes(texte(brut.tonalitePreferee))
      ? brut.tonalitePreferee
      : 'intense') as ProfilUtilisateur['tonalitePreferee'],
    dureeMax: typeof brut.dureeMax === 'number' ? nombre(brut.dureeMax, 180, 30, 600) : null,
    languePreferee: (['vo', 'vf', 'indifferent'].includes(texte(brut.languePreferee))
      ? brut.languePreferee
      : 'indifferent') as ProfilUtilisateur['languePreferee'],
    epoquePreferee: (['recent', 'classique', 'indifferent'].includes(texte(brut.epoquePreferee))
      ? brut.epoquePreferee
      : 'indifferent') as ProfilUtilisateur['epoquePreferee'],
    animationOk: brut.animationOk !== false,
    plateformes: listeDeTextes(brut.plateformes),
    pays: texte(brut.pays, 'FR').slice(0, 2).toUpperCase() || 'FR',
    gouts: vecteurGouts(brut.gouts),
    aEviter: listeDeTextes(brut.aEviter).map((x) => x.slice(0, 60)),
    interets: listeDeTextes(brut.interets).map((x) => x.slice(0, 60)),
  };
}

/** Normalise l'historique reçu du navigateur. */
export function historiqueValide(valeur: unknown): Historique {
  const brut = (valeur ?? {}) as Record<string, unknown>;
  const vus: Record<string, 1 | -1> = {};
  if (brut.vus && typeof brut.vus === 'object') {
    for (const [cle, note] of Object.entries(brut.vus as Record<string, unknown>)) {
      if (note === 1 || note === -1) vus[cle.slice(0, 40)] = note;
    }
  }
  const compteurs = (source: unknown): Record<string, number> => {
    const sortie: Record<string, number> = {};
    if (source && typeof source === 'object') {
      for (const [cle, v] of Object.entries(source as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) sortie[cle.slice(0, 40)] = v;
      }
    }
    return sortie;
  };

  return {
    vus,
    refuses: listeDeTextes(brut.refuses),
    liste: listeDeTextes(brut.liste),
    expositions: compteurs(brut.expositions),
    derniereProposition: compteurs(brut.derniereProposition),
  };
}

/** Normalise le contexte de visionnage. */
export function contexteValide(valeur: unknown): Contexte {
  const brut = (valeur ?? {}) as Record<string, unknown>;
  const humeur = texte(brut.humeur);
  return {
    humeur: (HUMEURS.includes(humeur) ? humeur : null) as Contexte['humeur'],
    compagnie: (COMPAGNIES.includes(texte(brut.compagnie))
      ? brut.compagnie
      : 'seul') as Contexte['compagnie'],
    heure: nombre(brut.heure, new Date().getHours(), 0, 23),
    jour: nombre(brut.jour, new Date().getDay(), 0, 6),
    maintenant: Date.now(),
  };
}
