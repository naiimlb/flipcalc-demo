/* =====================================================================
   explication.ts — La phrase « Pourquoi pour toi ».
   ---------------------------------------------------------------------
   Exigence de transparence du cahier des charges : chaque carte doit
   dire, en français, ce qui l'a fait remonter. La phrase est construite
   localement à partir du détail du score — aucune API n'est nécessaire.
   L'API Claude, si elle est configurée, ne fait que reformuler ce texte
   (voir `src/app/api/pourquoi/route.ts`).
   ===================================================================== */

import { ageALaSortie, estNostalgique, generation } from './epoque.ts';
import { similariteTitres } from './diversite.ts';
import type { Contexte, DetailScore, Humeur, ProfilUtilisateur, Titre, Tonalite } from './types.ts';

/** Ce que la personne « cherche » selon l'humeur choisie. */
const ATTENTE_PAR_HUMEUR: Record<Humeur, string> = {
  fatigue: 'quelque chose de léger et pas trop long',
  joyeux: 'quelque chose de solaire',
  triste: 'quelque chose qui te prend aux tripes',
  adrenaline: 'quelque chose d’intense',
  rire: 'de quoi rire franchement',
  romantique: 'quelque chose de romantique',
  reflexion: 'de quoi réfléchir',
  evasion: 'de quoi t’évader',
  frisson: 'de quoi frissonner',
};

/** Libellés lisibles des tonalités. */
export const LIBELLE_TONALITE: Record<Tonalite, string> = {
  leger: 'léger',
  intense: 'intense',
  emouvant: 'émouvant',
  reflechi: 'réfléchi',
  flippant: 'flippant',
};

export interface OptionsExplication {
  /** Titres que la personne a aimés : sert à citer une référence connue. */
  titresAimes?: Titre[];
  /** Le titre a-t-il été injecté au titre de la découverte ? */
  pepite?: boolean;
  /** Année de référence, injectable pour des tests déterministes. */
  anneeCourante?: number;
  /**
   * Rang de la carte dans la liste. Sert uniquement à faire tourner les
   * angles d'attaque : dix cartes qui commencent toutes par la même
   * formule donnent une impression de robot, pas de conseil.
   */
  variante?: number;
}

/**
 * Cherche, parmi les titres aimés, celui qui ressemble le plus à la
 * proposition — c'est la référence la plus convaincante à citer.
 */
export function referenceLaPlusProche(titre: Titre, titresAimes: Titre[], seuil = 0.22): Titre | null {
  let meilleur: Titre | null = null;
  let max = seuil;
  for (const aime of titresAimes) {
    if (aime.id === titre.id) continue;
    const s = similariteTitres(titre, aime);
    if (s > max) {
      max = s;
      meilleur = aime;
    }
  }
  return meilleur;
}

/** Adjectif féminin pluriel d'une tonalité : « des ambiances intenses ». */
const AMBIANCE_PAR_TONALITE: Record<Tonalite, string> = {
  leger: 'légères',
  intense: 'intenses',
  emouvant: 'émouvantes',
  reflechi: 'réfléchies',
  flippant: 'qui font froid dans le dos',
};

/** Un angle d'attaque possible pour la phrase, avec sa force. */
interface Ancrage {
  texte: string;
  force: number;
}

/**
 * `true` si les deux fragments partagent une racine de mot notable.
 * Comparaison volontairement grossière : on ne cherche pas la rigueur
 * linguistique, seulement à éviter les répétitions les plus voyantes,
 * du type « les ambiances intenses … quelque chose d'intense ».
 */
function seRepete(a: string, b: string): boolean {
  const racines = (texte: string) =>
    texte
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z]+/)
      .filter((mot) => mot.length >= 6)
      .map((mot) => mot.slice(0, 6));
  const ensemble = new Set(racines(a));
  return racines(b).some((mot) => ensemble.has(mot));
}

/** « de Dune » mais « d’Inception » : élision devant voyelle ou h muet. */
function de(nom: string): string {
  const premiere = nom.trim().charAt(0).toLowerCase();
  return 'aeiouyàâéèêëîïôöûü'.includes(premiere) ? `d’${nom}` : `de ${nom}`;
}

/** Empreinte stable d'une chaîne : la variation ne doit pas être aléatoire. */
function empreinte(texte: string): number {
  let h = 0;
  for (let i = 0; i < texte.length; i += 1) h = (h * 31 + texte.charCodeAt(i)) % 100000;
  return h;
}

/**
 * Construit tous les angles d'attaque disponibles, du plus au moins
 * convaincant. On n'en gardera qu'un.
 */
function construireAncrages(
  titre: Titre,
  detail: DetailScore,
  reference: Titre | null,
): Ancrage[] {
  const ancrages: Ancrage[] = [];

  if (reference) {
    // Citer un titre que la personne a aimé est l'argument le plus
    // convaincant : il l'emporte toujours. On fait en revanche tourner
    // la formulation, pour qu'une même référence ne se lise pas deux
    // fois à l'identique dans la liste.
    for (const texte of [
      `Parce que tu as adoré ${reference.titre}`,
      `Parce que ${reference.titre} t’a plu`,
      `Parce que c’est dans la veine ${de(reference.titre)}`,
    ]) {
      ancrages.push({ texte, force: 2 });
    }
  }

  const maxContribution = detail.contributions[0]?.valeur ?? 0;
  for (const c of detail.contributions.slice(0, 4)) {
    if (!c.libelle) continue;
    const force = maxContribution > 0 ? c.valeur / maxContribution : 0;
    switch (c.facette) {
      case 'realisateurs':
        ancrages.push({ texte: `Parce que tu suis le cinéma de ${c.libelle}`, force: force * 0.95 });
        break;
      case 'acteurs':
        ancrages.push({ texte: `Parce que tu aimes voir ${c.libelle} à l’écran`, force: force * 0.85 });
        break;
      case 'motsCles':
        ancrages.push({
          texte: `Parce que les histoires de ${c.libelle.toLowerCase()} te parlent`,
          force: force * 0.9,
        });
        break;
      case 'genres':
        ancrages.push({ texte: `Parce que tu aimes ${articleGenre(c.libelle)}`, force });
        ancrages.push({ texte: `Parce que ${articleGenre(c.libelle)} te réussit`, force: force * 0.999 });
        break;
      case 'tonalites': {
        const ambiance = AMBIANCE_PAR_TONALITE[c.libelle as Tonalite];
        if (ambiance) {
          ancrages.push({ texte: `Parce que tu aimes les ambiances ${ambiance}`, force: force * 0.8 });
          ancrages.push({ texte: `Parce que les ambiances ${ambiance} te parlent`, force: force * 0.799 });
        }
        break;
      }
      case 'decennies':
        ancrages.push({ texte: `Parce que les ${c.libelle} te réussissent`, force: force * 0.55 });
        break;
      default:
        break;
    }
  }

  return ancrages.sort((a, b) => b.force - a.force);
}

/**
 * Compose la phrase « Pourquoi pour toi ».
 * Une à deux phrases courtes, toujours à la deuxième personne.
 */
export function genererPourquoi(
  titre: Titre,
  detail: DetailScore,
  profil: ProfilUtilisateur,
  contexte: Contexte,
  options: OptionsExplication = {},
): string {
  const anneeCourante = options.anneeCourante ?? new Date().getFullYear();
  const fragments: string[] = [];

  // --- 1. L'ancrage principal : pourquoi CE titre plutôt qu'un autre ---
  const reference = options.titresAimes?.length
    ? referenceLaPlusProche(titre, options.titresAimes)
    : null;
  const ancrages = construireAncrages(titre, detail, reference);

  if (ancrages.length === 0) {
    fragments.push('Parce qu’il est temps d’élargir un peu ton horizon');
  } else {
    // On ne garde que les angles comparables au meilleur, puis on tourne
    // entre eux : même conviction, mais pas dix fois la même phrase.
    const plafond = ancrages[0].force;
    let credibles = ancrages.filter((a) => a.force >= plafond * 0.35);

    // On écarte les angles qui bégaieraient avec la suite de la phrase :
    // « tu aimes les ambiances intenses et tu cherches quelque chose
    // d'intense » se lit mal. Si tous bégaient, on garde quand même :
    // mieux vaut une répétition qu'aucune explication.
    if (contexte.humeur) {
      const sansRepetition = credibles.filter((a) => !seRepete(a.texte, ATTENTE_PAR_HUMEUR[contexte.humeur!]));
      if (sansRepetition.length > 0) credibles = sansRepetition;
    }

    const index = (empreinte(titre.id) + (options.variante ?? 0)) % credibles.length;
    fragments.push(credibles[index].texte);
  }

  // --- 2. Le moment ----------------------------------------------------
  if (contexte.humeur) {
    fragments.push(`et que tu cherches ${ATTENTE_PAR_HUMEUR[contexte.humeur]} ce soir`);
  } else if (contexte.compagnie === 'famille') {
    fragments.push('et que c’est une soirée en famille');
  } else if (contexte.compagnie === 'couple') {
    fragments.push('et que vous êtes à deux');
  } else if (contexte.compagnie === 'potes') {
    fragments.push('et que c’est soirée entre potes');
  }

  let phrase = `${fragments.join(' ')}.`;

  // --- 3. Un second argument, au plus ----------------------------------
  const bonus: string[] = [];

  if (estNostalgique(titre, profil)) {
    const ageSortie = ageALaSortie(profil.anneeNaissance, titre.annee);
    bonus.push(`Sorti quand tu avais ${ageSortie} ans — plein dans ta période.`);
  } else if (options.pepite) {
    bonus.push('Une pépite hors de ta zone de confort, mais taillée pour ton profil.');
  } else if (detail.qualite >= 0.78 && titre.nbVotes > 500) {
    bonus.push(`Et c’est solide : ${titre.note.toFixed(1)}/10 sur TMDB.`);
  } else if (anneeCourante - titre.annee <= 1) {
    bonus.push('Et c’est une sortie toute fraîche.');
  }

  if (bonus.length > 0) phrase += ` ${bonus[0]}`;
  return phrase;
}

/** « la science-fiction », « l'horreur », « le thriller »… */
function articleGenre(genre: string): string {
  const feminins = ['Science-Fiction', 'Comédie', 'Romance', 'Animation', 'Aventure', 'Histoire', 'Guerre', 'Musique'];
  const premiere = genre.charAt(0).toLowerCase();
  const voyelle = 'aeiouyéèê'.includes(premiere);
  const minuscule = genre.toLowerCase();
  if (voyelle) return `l’${minuscule}`;
  return feminins.includes(genre) ? `la ${minuscule}` : `le ${minuscule}`;
}

/**
 * Le « profil cinéma » affiché à la fin du test : un titre stylé et un
 * résumé des goûts. Purement déterministe, donc testable.
 */
export function profilCinema(profil: ProfilUtilisateur): { titre: string; resume: string } {
  const tonalite = profil.tonalitePreferee;
  const genreFort = profil.genresAdores[0] ?? 'cinéma';

  // Des intitulés volontairement épicènes : ils qualifient une personne
  // réelle, dont on ne connaît pas le genre (question facultative du test).
  const noms: Record<Tonalite, string[]> = {
    leger: ['Canapé optimiste', 'Soirées douces', 'Feel-good assumé'],
    intense: ['Nuits intenses', 'Plein régime', 'Adrénaline en boucle'],
    emouvant: ['Cœur à vif', 'Collection d’émotions', 'Grand écran, grandes larmes'],
    reflechi: ['Vertige assumé', 'Cinéma qui pense', 'Longue réflexion'],
    flippant: ['Veille de minuit', 'Frissons garantis', 'Couloirs sombres'],
  };

  const liste = noms[tonalite];
  // Choix déterministe : le pseudo décide, pas le hasard.
  const index = [...profil.pseudo].reduce((acc, c) => acc + c.charCodeAt(0), 0) % liste.length;

  const resume =
    `${generation(profil.anneeNaissance)} · ${genreFort.toLowerCase()} · ambiance ${LIBELLE_TONALITE[tonalite]}` +
    (profil.genresDetestes.length ? ` · sans ${profil.genresDetestes.join(', ').toLowerCase()}` : '');

  return { titre: liste[index], resume };
}
