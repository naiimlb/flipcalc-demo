/* =====================================================================
   aide-tests.ts — Fabriques d'objets pour les tests unitaires.
   Ce module n'est utilisé que par les tests ; il n'est jamais importé
   par l'application.
   ===================================================================== */

import { historiqueVide, vecteurVide } from './profil.ts';
import type { Contexte, Historique, ProfilUtilisateur, Titre } from './types.ts';

let compteur = 0;

/** Un titre par défaut, dont on ne surcharge que ce qui compte pour le test. */
export function titre(partiel: Partial<Titre> = {}): Titre {
  compteur += 1;
  const base: Titre = {
    id: `film:${1000 + compteur}`,
    tmdbId: 1000 + compteur,
    type: 'film',
    titre: `Titre ${compteur}`,
    annee: 2015,
    duree: 110,
    saisons: null,
    genres: ['Drame'],
    motsCles: [],
    realisateurs: [],
    acteurs: [],
    pays: ['US'],
    langueOriginale: 'en',
    note: 7,
    nbVotes: 2000,
    popularite: 50,
    classification: 'TP',
    plateformes: ['netflix'],
    synopsis: '',
    tonalites: ['reflechi'],
    rythme: 'modere',
    affiche: null,
    fond: null,
    bandeAnnonce: null,
    animation: false,
  };
  return { ...base, ...partiel };
}

/** Un profil par défaut : adulte, toutes plateformes, sans interdit. */
export function profil(partiel: Partial<ProfilUtilisateur> = {}): ProfilUtilisateur {
  const base: ProfilUtilisateur = {
    pseudo: 'Testeur',
    anneeNaissance: 1990,
    typesSouhaites: ['film', 'serie'],
    genresAdores: [],
    genresDetestes: [],
    tonalitePreferee: 'intense',
    dureeMax: null,
    languePreferee: 'indifferent',
    epoquePreferee: 'indifferent',
    animationOk: true,
    plateformes: ['netflix'],
    pays: 'FR',
    gouts: vecteurVide(),
    aEviter: [],
    interets: [],
  };
  return { ...base, ...partiel };
}

export function historique(partiel: Partial<Historique> = {}): Historique {
  return { ...historiqueVide(), ...partiel };
}

/** Contexte figé : mardi 20 h, seul — rien ne dépend de l'horloge réelle. */
export function contexte(partiel: Partial<Contexte> = {}): Contexte {
  const base: Contexte = {
    humeur: null,
    compagnie: 'seul',
    heure: 20,
    jour: 2,
    maintenant: Date.UTC(2026, 0, 6, 19, 0, 0),
  };
  return { ...base, ...partiel };
}
