/* =====================================================================
   demo-profils.ts — Preuve par l'exemple que l'algorithme différencie.
   ---------------------------------------------------------------------
   Trois personnes fictives, volontairement éloignées : âge, plateformes,
   goûts, humeur et contexte. Le script affiche ce que le moteur propose
   à chacune, puis mesure le recouvrement entre les sélections.

   Lancer :  npm run demo:profils
   (aucune dépendance, aucune clé d'API : Node exécute le TypeScript.)
   ===================================================================== */

import { CATALOGUE_DEMO } from '../src/data/catalogue-demo.ts';
import { construireProfilDepuisTest, historiqueVide } from '../src/lib/reco/profil.ts';
import type { ReponsesTest } from '../src/lib/reco/profil.ts';
import { recommander } from '../src/lib/reco/moteur.ts';
import { profilCinema } from '../src/lib/reco/explication.ts';
import { generation } from '../src/lib/reco/epoque.ts';
import { PLATEFORME_PAR_ID } from '../src/lib/reco/plateformes.ts';
import type { Contexte, Titre } from '../src/lib/reco/types.ts';

const ANNEE = 2026;
const TAILLE = 10;

/** Retrouve un titre du catalogue par son nom, pour construire les tests. */
function parNom(nom: string): Titre {
  const t = CATALOGUE_DEMO.find((x) => x.titre === nom);
  if (!t) throw new Error(`Titre absent du catalogue de démo : ${nom}`);
  return t;
}

interface Persona {
  description: string;
  reponses: ReponsesTest;
  contexte: Contexte;
}

/* ---------------------------------------------------------------------
   Les trois profils fictifs.
   --------------------------------------------------------------------- */
const PERSONAS: Persona[] = [
  {
    description:
      'Camille, 58 ans. Abonnée Canal+, regarde arte.tv et france.tv. Cinéphile,\n' +
      '   aime le drame, l’histoire et le polar français. Ne supporte pas l’horreur.\n' +
      '   Dimanche 21 h, seule, envie de réfléchir.',
    reponses: {
      pseudo: 'Camille',
      anneeNaissance: 1968,
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Drame', 'Histoire', 'Crime'],
      genresDetestes: ['Horreur', 'Animation'],
      favoris: [
        parNom('Le Nom de la rose'),
        parNom('La Haine'),
        parNom('Anatomie d’une chute'),
        parNom('Portrait de la jeune fille en feu'),
        parNom('Le Bureau des légendes'),
      ],
      enfance: [parNom('Le Bon, la Brute et le Truand'), parNom('La Grande Vadrouille')],
      tonalitePreferee: 'reflechi',
      dureeMax: null,
      languePreferee: 'vo',
      epoquePreferee: 'indifferent',
      animationOk: false,
      plateformes: ['canal', 'arte', 'francetv'],
      pays: 'FR',
    },
    contexte: { humeur: 'reflexion', compagnie: 'seul', heure: 21, jour: 0, maintenant: Date.UTC(2026, 0, 11, 20) },
  },
  {
    description:
      'Yanis, 31 ans. Netflix + Max + Prime Video. Science-fiction, action, thrillers,\n' +
      '   fan de Nolan et Villeneuve. Allergique à la comédie romantique.\n' +
      '   Vendredi 22 h 30, entre potes, besoin d’adrénaline.',
    reponses: {
      pseudo: 'Yanis',
      anneeNaissance: 1995,
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Science-Fiction', 'Thriller', 'Action'],
      genresDetestes: ['Romance', 'Musique'],
      favoris: [
        parNom('Interstellar'),
        parNom('Inception'),
        parNom('Dune'),
        parNom('Mad Max : Fury Road'),
        parNom('Breaking Bad'),
      ],
      enfance: [parNom('Le Seigneur des anneaux : La Communauté de l’anneau'), parNom('Matrix')],
      tonalitePreferee: 'intense',
      dureeMax: 170,
      languePreferee: 'vo',
      epoquePreferee: 'indifferent',
      animationOk: true,
      plateformes: ['netflix', 'max', 'prime'],
      pays: 'FR',
    },
    contexte: { humeur: 'adrenaline', compagnie: 'potes', heure: 22, jour: 5, maintenant: Date.UTC(2026, 0, 9, 21) },
  },
  {
    description:
      'Louna, 15 ans. Netflix, Crunchyroll et Disney+. Animation japonaise, fantastique,\n' +
      '   aventure. Mercredi 19 h, en famille, envie d’évasion.\n' +
      '   → aucun contenu -16/-18 ne doit apparaître, et le plafond « famille » s’applique.',
    reponses: {
      pseudo: 'Louna',
      anneeNaissance: 2011,
      typesSouhaites: ['film', 'serie'],
      genresAdores: ['Animation', 'Fantastique', 'Aventure'],
      genresDetestes: ['Documentaire', 'Guerre'],
      favoris: [
        parNom('Your Name'),
        parNom('Le Voyage de Chihiro'),
        parNom('Arcane'),
        parNom('Spider-Man : New Generation'),
        parNom('Mercredi'),
      ],
      enfance: [parNom('Vice-versa'), parNom('Coco')],
      tonalitePreferee: 'leger',
      dureeMax: 130,
      languePreferee: 'vo',
      epoquePreferee: 'recent',
      animationOk: true,
      plateformes: ['netflix', 'crunchyroll', 'disney'],
      pays: 'FR',
    },
    contexte: { humeur: 'evasion', compagnie: 'famille', heure: 19, jour: 3, maintenant: Date.UTC(2026, 0, 7, 18) },
  },
];

/* ---------------------------------------------------------------------
   Exécution.
   --------------------------------------------------------------------- */
const TIRET = '─'.repeat(78);
const selections = new Map<string, string[]>();

for (const persona of PERSONAS) {
  const profil = construireProfilDepuisTest(persona.reponses);
  const carte = profilCinema(profil);
  const resultat = recommander(CATALOGUE_DEMO, profil, historiqueVide(), persona.contexte, {
    taille: TAILLE,
    anneeCourante: ANNEE,
    titresAimes: [...persona.reponses.favoris, ...persona.reponses.enfance],
  });

  console.log(`\n${TIRET}`);
  console.log(`  ${profil.pseudo.toUpperCase()} — ${generation(profil.anneeNaissance)}, ${ANNEE - profil.anneeNaissance} ans`);
  console.log(`${TIRET}`);
  console.log(`   ${persona.description}`);
  console.log(`\n   Profil cinéma : « ${carte.titre} »`);
  console.log(`   ${carte.resume}`);
  console.log(
    `   Plateformes : ${profil.plateformes.map((p) => PLATEFORME_PAR_ID[p]?.nom ?? p).join(', ')}`,
  );
  console.log(
    `   Catalogue : ${resultat.catalogueTotal} titres → ${resultat.candidatsRetenus} éligibles après filtrage strict\n`,
  );

  resultat.recommandations.forEach((reco, i) => {
    const t = reco.titre;
    const format = t.type === 'film' ? `${t.duree} min` : `${t.saisons} saison${(t.saisons ?? 0) > 1 ? 's' : ''}`;
    const plateforme = PLATEFORME_PAR_ID[t.plateformes.find((p) => profil.plateformes.includes(p)) ?? '']?.nom ?? '—';
    const badge = reco.pepite ? ' ✦ pépite' : '';
    console.log(`   ${String(i + 1).padStart(2)}. ${t.titre} (${t.annee}) · ${format} · ${t.classification} · ${plateforme}${badge}`);
    console.log(`       ${t.genres.join(', ')} — note ${t.note}/10 — score ${reco.score.toFixed(3)}`);
    console.log(`       « ${reco.pourquoi} »`);
  });

  selections.set(profil.pseudo, resultat.recommandations.map((r) => r.titre.id));

  // Contrôles automatiques : ce que l'on promet à l'utilisateur.
  const horsPlateforme = resultat.recommandations.filter(
    (r) => !r.titre.plateformes.some((p) => profil.plateformes.includes(p)),
  );
  const ageMax = ANNEE - profil.anneeNaissance;
  const interdits = resultat.recommandations.filter((r) => {
    const seuils: Record<string, number> = { TP: 0, '10': 10, '12': 12, '16': 16, '18': 18 };
    return seuils[r.titre.classification] > ageMax;
  });
  console.log(`\n   ✓ Titres hors plateformes : ${horsPlateforme.length}`);
  console.log(`   ✓ Titres interdits à son âge : ${interdits.length}`);
  if (persona.contexte.compagnie === 'famille') {
    const nonFamiliaux = resultat.recommandations.filter((r) => !['TP', '10'].includes(r.titre.classification));
    console.log(`   ✓ Titres non tout-public alors qu’on est en famille : ${nonFamiliaux.length}`);
  }
}

/* --- Recouvrement entre les trois sélections ------------------------- */
console.log(`\n${TIRET}`);
console.log('  RECOUVREMENT ENTRE LES TROIS SÉLECTIONS');
console.log(`${TIRET}`);
const noms = [...selections.keys()];
for (let i = 0; i < noms.length; i += 1) {
  for (let j = i + 1; j < noms.length; j += 1) {
    const a = new Set(selections.get(noms[i]));
    const communs = (selections.get(noms[j]) ?? []).filter((id) => a.has(id));
    console.log(
      `   ${noms[i]} ∩ ${noms[j]} : ${communs.length}/${TAILLE} titre(s) en commun` +
        (communs.length ? ` (${communs.join(', ')})` : ''),
    );
  }
}
console.log('');
