/* =====================================================================
   profils-reference.ts — Six personnes fictives, volontairement éloignées.
   ---------------------------------------------------------------------
   Ce jeu de profils sert à deux choses :
     • la campagne de validation (`validation.test.ts`), qui vérifie les
       règles non négociables sur chaque profil et chaque humeur ;
     • le rapport lisible (`scripts/valider-algorithme.ts`).

   Ils couvrent délibérément les cas difficiles : un mineur, quelqu'un
   sans aucun abonnement, un senior sur les seules offres gratuites, et
   un profil « impossible » avec sept genres détestés et une plateforme.
   ===================================================================== */

import { CATALOGUE_DEMO } from '../../data/catalogue-demo.ts';
import { construireProfilDepuisTest } from './profil.ts';
import type { ReponsesTest } from './profil.ts';
import type { Compagnie, Contexte, Humeur, ProfilUtilisateur, Titre } from './types.ts';

/** Année de référence de toute la campagne : les tests sont déterministes. */
export const ANNEE_REFERENCE = 2026;

/** Retrouve un titre du catalogue par son nom exact. */
export function parNom(nom: string): Titre {
  const t = CATALOGUE_DEMO.find((x) => x.titre === nom);
  if (!t) throw new Error(`Titre absent du catalogue : « ${nom} »`);
  return t;
}

export interface PersonneTest {
  cle: string;
  description: string;
  reponses: ReponsesTest;
}

/* =====================================================================
   Les six profils.
   ===================================================================== */
export const PERSONNES: PersonneTest[] = [
  {
    cle: 'lina',
    description:
      'Lina, 15 ans. Netflix + Crunchyroll. Animation japonaise, action, aventure.\n' +
      'Ne supporte pas l’horreur. Cas limite : aucun contenu -16/-18 ne doit passer.',
    reponses: {
      pseudo: 'Lina',
      anneeNaissance: 2011,
      genrePersonne: 'Femme',
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Animation', 'Action', 'Aventure', 'Fantastique'],
      genresDetestes: ['Horreur', 'Documentaire'],
      favoris: [
        parNom('My Hero Academia'),
        parNom('Spy × Family'),
        parNom('Your Name'),
        parNom('Spider-Man : Across the Spider-Verse'),
        parNom('Haikyu!!'),
      ],
      enfance: [parNom('Spider-Man : New Generation'), parNom('Encanto'), parNom('Frieren')],
      tonalitePreferee: 'intense',
      dureeMax: 130,
      languePreferee: 'vo',
      epoquePreferee: 'recent',
      animationOk: true,
      plateformes: ['netflix', 'crunchyroll'],
      pays: 'FR',
    },
  },
  {
    cle: 'sarah',
    description:
      'Sarah, 28 ans. Prime Video + Disney+. Comédies romantiques et séries feel-good.\n' +
      'Évite l’horreur et les films de guerre.',
    reponses: {
      pseudo: 'Sarah',
      anneeNaissance: 1998,
      genrePersonne: 'Femme',
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Romance', 'Comédie', 'Drame'],
      genresDetestes: ['Horreur', 'Guerre'],
      favoris: [
        parNom('Love Actually'),
        parNom('Le Diable s’habille en Prada'),
        parNom('The Marvelous Mrs. Maisel'),
        parNom('Only Murders in the Building'),
        parNom('Crazy Rich Asians'),
      ],
      enfance: [parNom('Ratatouille'), parNom('Là-haut'), parNom('Mamma Mia !')],
      tonalitePreferee: 'emouvant',
      dureeMax: null,
      languePreferee: 'indifferent',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['prime', 'disney'],
      pays: 'FR',
    },
  },
  {
    cle: 'marc',
    description:
      'Marc, 45 ans. Canal+ + Netflix. Thrillers, polars, et un attachement marqué\n' +
      'aux films des années 90. Ne veut ni romance, ni comédie musicale, ni animation.',
    reponses: {
      pseudo: 'Marc',
      anneeNaissance: 1981,
      genrePersonne: 'Homme',
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Thriller', 'Crime', 'Mystère'],
      genresDetestes: ['Romance', 'Musique', 'Animation'],
      favoris: [
        parNom('Seven'),
        parNom('Usual Suspects'),
        parNom('Heat'),
        parNom('L.A. Confidential'),
        parNom('Breaking Bad'),
      ],
      enfance: [parNom('Matrix'), parNom('Pulp Fiction'), parNom('Le Silence des agneaux')],
      tonalitePreferee: 'intense',
      dureeMax: 170,
      languePreferee: 'vo',
      epoquePreferee: 'classique',
      animationOk: false,
      plateformes: ['canal', 'netflix'],
      pays: 'FR',
    },
  },
  {
    cle: 'tom',
    description:
      'Tom, 22 ans. AUCUN abonnement : offres gratuites uniquement (arte.tv, france.tv,\n' +
      'TF1+, M6+, Pluto TV). Documentaires et science-fiction.',
    reponses: {
      pseudo: 'Tom',
      anneeNaissance: 2004,
      genrePersonne: 'Je préfère ne pas répondre',
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Documentaire', 'Science-Fiction', 'Histoire'],
      genresDetestes: ['Horreur', 'Romance'],
      favoris: [
        parNom('Home'),
        parNom('Apollo 11'),
        parNom('Bienvenue à Gattaca'),
        parNom('Brazil'),
        parNom('Le Sel de la Terre'),
      ],
      enfance: [parNom('Demain'), parNom('Human')],
      tonalitePreferee: 'reflechi',
      dureeMax: null,
      languePreferee: 'vo',
      epoquePreferee: 'indifferent',
      animationOk: true,
      // Tableau vide = « je n'ai aucun abonnement ».
      plateformes: [],
      pays: 'FR',
    },
  },
  {
    cle: 'helene',
    description:
      'Hélène, 65 ans. france.tv + arte.tv. Classiques du patrimoine et drames\n' +
      'historiques. Ni horreur, ni science-fiction, ni film d’action.',
    reponses: {
      pseudo: 'Hélène',
      anneeNaissance: 1961,
      genrePersonne: 'Femme',
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Drame', 'Histoire', 'Romance'],
      genresDetestes: ['Horreur', 'Science-Fiction', 'Action'],
      favoris: [
        parNom('Les Parapluies de Cherbourg'),
        parNom('Jean de Florette'),
        parNom('Cyrano de Bergerac'),
        parNom('Au revoir les enfants'),
        parNom('La Reine Margot'),
      ],
      enfance: [parNom('Z'), parNom('Le Cercle rouge'), parNom('Le Vieux Fusil')],
      tonalitePreferee: 'emouvant',
      dureeMax: null,
      languePreferee: 'vf',
      epoquePreferee: 'classique',
      animationOk: false,
      plateformes: ['francetv', 'arte'],
      pays: 'FR',
    },
  },
  {
    cle: 'remi',
    description:
      'Rémi, 38 ans. Le profil difficile : UNE seule plateforme (Netflix), sept genres\n' +
      'détestés, pas d’animation, et rien au-delà d’1 h 50. Cherche de la\n' +
      'science-fiction cérébrale et des récits à énigme.',
    reponses: {
      pseudo: 'Rémi',
      anneeNaissance: 1988,
      genrePersonne: 'Non binaire',
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Science-Fiction', 'Mystère'],
      genresDetestes: ['Horreur', 'Romance', 'Musique', 'Documentaire', 'Western', 'Guerre', 'Animation'],
      favoris: [
        parNom('Dark'),
        parNom('Black Mirror'),
        parNom('Stranger Things'),
        parNom('Mindhunter'),
        parNom('Matrix'),
      ],
      enfance: [parNom('Matrix'), parNom('Sixième Sens')],
      tonalitePreferee: 'reflechi',
      dureeMax: 110,
      languePreferee: 'vo',
      epoquePreferee: 'indifferent',
      animationOk: false,
      plateformes: ['netflix'],
      pays: 'FR',
    },
  },
];

/** Construit le profil exploitable d'une personne de test. */
export function profilDe(personne: PersonneTest): ProfilUtilisateur {
  return construireProfilDepuisTest(personne.reponses);
}

/** Les titres que la personne a déclaré aimer (pour les explications). */
export function titresAimesDe(personne: PersonneTest): Titre[] {
  return [...personne.reponses.favoris, ...personne.reponses.enfance];
}

/* =====================================================================
   Les contextes testés : quatre humeurs, plus « en famille » et
   « en couple », comme demandé.
   ===================================================================== */
export interface ContexteTest {
  cle: string;
  libelle: string;
  humeur: Humeur | null;
  compagnie: Compagnie;
  heure: number;
  jour: number;
}

export const CONTEXTES: ContexteTest[] = [
  { cle: 'fatigue', libelle: 'Fatigué, seul, mardi 22 h', humeur: 'fatigue', compagnie: 'seul', heure: 22, jour: 2 },
  { cle: 'adrenaline', libelle: 'Adrénaline, seul, vendredi 21 h', humeur: 'adrenaline', compagnie: 'seul', heure: 21, jour: 5 },
  { cle: 'triste', libelle: 'Triste, seul, dimanche 20 h', humeur: 'triste', compagnie: 'seul', heure: 20, jour: 0 },
  { cle: 'rire', libelle: 'Envie de rire, seul, jeudi 21 h', humeur: 'rire', compagnie: 'seul', heure: 21, jour: 4 },
  { cle: 'famille', libelle: 'Évasion, EN FAMILLE, mercredi 19 h', humeur: 'evasion', compagnie: 'famille', heure: 19, jour: 3 },
  { cle: 'couple', libelle: 'Romantique, EN COUPLE, samedi 21 h', humeur: 'romantique', compagnie: 'couple', heure: 21, jour: 6 },
];

/** Transforme un contexte de test en contexte moteur, horodaté de façon fixe. */
export function contexteDe(c: ContexteTest): Contexte {
  return {
    humeur: c.humeur,
    compagnie: c.compagnie,
    heure: c.heure,
    jour: c.jour,
    // Date figée : aucun test ne dépend de l'heure à laquelle il tourne.
    maintenant: Date.UTC(2026, 0, 6, 19, 0, 0),
  };
}
