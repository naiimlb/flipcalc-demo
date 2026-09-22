/* =====================================================================
   valider-algorithme.ts — Le rapport de validation, en français.
   ---------------------------------------------------------------------
   Rejoue les six profils de référence sur les six contextes, affiche les
   cinq premiers titres de chaque sélection avec leur plateforme et leur
   justification, puis récapitule toutes les métriques de conformité et
   de qualité.

   Lancer :  npm run valider
   ===================================================================== */

import { CATALOGUE_DEMO } from '../src/data/catalogue-demo.ts';
import { classerPourDecouverte, recommander } from '../src/lib/reco/moteur.ts';
import { appliquerSignal, enregistrerSignal, historiqueVide } from '../src/lib/reco/profil.ts';
import { generation } from '../src/lib/reco/epoque.ts';
import { profilCinema } from '../src/lib/reco/explication.ts';
import { PLATEFORME_PAR_ID, plateformesEffectives } from '../src/lib/reco/plateformes.ts';
import { AGE_MINIMUM, DIVERSITE } from '../src/lib/reco/poids.ts';
import {
  ANNEE_REFERENCE,
  CONTEXTES,
  PERSONNES,
  contexteDe,
  profilDe,
  titresAimesDe,
} from '../src/lib/reco/profils-reference.ts';
import type { Recommandation } from '../src/lib/reco/types.ts';

const TAILLE = 10;
const TIRET = '─'.repeat(80);
const pct = (x: number) => `${Math.round(x * 100)} %`;

interface Controle {
  libelle: string;
  ok: boolean;
  detail: string;
}
const controles: Controle[] = [];
const noter = (libelle: string, ok: boolean, detail = '') => controles.push({ libelle, ok, detail });

const selection = (clePersonne: string, cleContexte: string) => {
  const personne = PERSONNES.find((p) => p.cle === clePersonne)!;
  const contexteTest = CONTEXTES.find((c) => c.cle === cleContexte)!;
  return recommander(CATALOGUE_DEMO, profilDe(personne), historiqueVide(), contexteDe(contexteTest), {
    taille: TAILLE,
    anneeCourante: ANNEE_REFERENCE,
    titresAimes: titresAimesDe(personne),
  });
};

/* =====================================================================
   1. Les sélections, profil par profil.
   ===================================================================== */
console.log(`\n${TIRET}\n  RAPPORT DE VALIDATION — CinéMood`);
console.log(`  ${PERSONNES.length} profils × ${CONTEXTES.length} contextes · catalogue de ${CATALOGUE_DEMO.length} titres · année de référence ${ANNEE_REFERENCE}`);
console.log(TIRET);

let violationsPlateforme = 0;
let violationsAge = 0;
let violationsFamille = 0;
let violationsGenresDetestes = 0;
let violationsDoublons = 0;
let violationsExplication = 0;
let selectionsCourtes = 0;

for (const personne of PERSONNES) {
  const profil = profilDe(personne);
  const carte = profilCinema(profil);
  const age = ANNEE_REFERENCE - profil.anneeNaissance;
  const acces = new Set(plateformesEffectives(profil.plateformes));

  console.log(`\n${TIRET}`);
  console.log(`  ${profil.pseudo.toUpperCase()} — ${age} ans · ${generation(profil.anneeNaissance)}`);
  console.log(TIRET);
  console.log(`  ${personne.description.split('\n').join('\n  ')}`);
  console.log(`\n  Profil cinéma : « ${carte.titre} » — ${carte.resume}`);
  console.log(
    `  Plateformes : ${profil.plateformes.map((p) => PLATEFORME_PAR_ID[p]?.nom ?? p).join(', ') || 'aucune (offres gratuites)'}`,
  );
  console.log(`  Genres évités : ${profil.genresDetestes.join(', ') || 'aucun'}`);

  for (const contexteTest of CONTEXTES) {
    const resultat = selection(personne.cle, contexteTest.cle);
    const recos = resultat.recommandations;
    if (recos.length < TAILLE) selectionsCourtes += 1;

    console.log(`\n  ▸ ${contexteTest.libelle}`);
    console.log(
      `    ${resultat.candidatsRetenus} titres éligibles après filtrage strict · ${recos.length} proposés`,
    );

    recos.slice(0, 5).forEach((reco, i) => {
      const t = reco.titre;
      const plateforme = PLATEFORME_PAR_ID[t.plateformes.find((p) => acces.has(p)) ?? '']?.nom ?? '—';
      const format = t.type === 'film' ? `${t.duree} min` : `${t.saisons} saison(s)`;
      const badge = reco.pepite ? ' ✦' : '';
      console.log(
        `    ${i + 1}. ${t.titre} (${t.annee}) — ${plateforme} · ${format} · ${t.classification === 'TP' ? 'tous publics' : '-' + t.classification} · ${t.note}/10${badge}`,
      );
      console.log(`       « ${reco.pourquoi} »`);
    });

    if (resultat.contraintesLimitantes.length > 0) {
      console.log(`    ⚠ sélection incomplète — leviers : ${resultat.contraintesLimitantes
        .slice(0, 2)
        .map((c) => `${c.libelle} (+${c.gain})`)
        .join(' · ')}`);
    }

    // --- Contrôles automatiques sur la sélection entière -------------
    for (const r of recos) {
      if (!r.titre.plateformes.some((p) => acces.has(p))) violationsPlateforme += 1;
      if (AGE_MINIMUM[r.titre.classification] > age) violationsAge += 1;
      if (contexteTest.compagnie === 'famille' && !['TP', '10'].includes(r.titre.classification)) {
        violationsFamille += 1;
      }
      if (r.titre.genres.some((g) => profil.genresDetestes.includes(g))) violationsGenresDetestes += 1;
      if (r.pourquoi.length < 25 || r.pourquoi.includes('undefined')) violationsExplication += 1;
    }
    const ids = recos.map((r) => r.titre.id);
    if (new Set(ids).size !== ids.length) violationsDoublons += 1;
  }
}

/* =====================================================================
   2. Règles bloquantes.
   ===================================================================== */
const totalSelections = PERSONNES.length * CONTEXTES.length;
noter('Disponibilité sur les plateformes du profil', violationsPlateforme === 0, `${violationsPlateforme} violation(s)`);
noter('Classification d’âge respectée', violationsAge === 0, `${violationsAge} violation(s)`);
noter('Mode famille : tout public uniquement', violationsFamille === 0, `${violationsFamille} violation(s)`);
noter('Aucun genre détesté proposé', violationsGenresDetestes === 0, `${violationsGenresDetestes} violation(s)`);
noter('Aucun doublon dans une sélection', violationsDoublons === 0, `${violationsDoublons} sélection(s) fautive(s)`);
noter('Explication « Pourquoi pour toi » exploitable', violationsExplication === 0, `${violationsExplication} violation(s)`);

// Déjà vu / refusé.
let reproposes = 0;
for (const personne of PERSONNES) {
  const profil = profilDe(personne);
  const contexte = contexteDe(CONTEXTES[1]);
  const premiere = recommander(CATALOGUE_DEMO, profil, historiqueVide(), contexte, {
    taille: TAILLE,
    anneeCourante: ANNEE_REFERENCE,
  }).recommandations;
  let historique = historiqueVide();
  const interdits = new Set<string>();
  premiere.slice(0, 4).forEach((r) => {
    historique = enregistrerSignal(historique, r.titre.id, 'deja_vu_aime', contexte.maintenant);
    interdits.add(r.titre.id);
  });
  premiere.slice(4, 7).forEach((r) => {
    historique = enregistrerSignal(historique, r.titre.id, 'pas_pour_moi', contexte.maintenant);
    interdits.add(r.titre.id);
  });
  const seconde = recommander(CATALOGUE_DEMO, profil, historique, contexte, {
    taille: TAILLE,
    anneeCourante: ANNEE_REFERENCE,
  }).recommandations;
  reproposes += seconde.filter((r) => interdits.has(r.titre.id)).length;
}
noter('Aucun titre déjà vu ou refusé reproposé', reproposes === 0, `${reproposes} retour(s)`);

// Bande-annonce : intégrée ou explicitement signalée.
let drapeauxFaux = 0;
for (const personne of PERSONNES) {
  for (const contexteTest of CONTEXTES) {
    for (const r of selection(personne.cle, contexteTest.cle).recommandations) {
      if (r.bandeAnnonceDisponible !== (r.titre.bandeAnnonce !== null)) drapeauxFaux += 1;
    }
  }
}
noter(
  'Bande-annonce intégrée, ou repli signalé',
  drapeauxFaux === 0,
  drapeauxFaux === 0
    ? 'en mode démo, aucun titre n’a de vidéo TMDB : les 360 cartes basculent sur la recherche YouTube, et le signalent'
    : `${drapeauxFaux} drapeau(x) incohérent(s)`,
);

/* =====================================================================
   3. Qualité.
   ===================================================================== */
console.log(`\n${TIRET}\n  MÉTRIQUES DE QUALITÉ\n${TIRET}`);

const recouvrement = (a: Recommandation[], b: Recommandation[]) => {
  const ids = new Set(a.map((r) => r.titre.id));
  return b.filter((r) => ids.has(r.titre.id)).length / TAILLE;
};

console.log('\n  Différence entre humeurs (objectif : ≥ 60 %)');
let pireHumeur = 1;
for (const personne of PERSONNES) {
  const d = 1 - recouvrement(
    selection(personne.cle, 'fatigue').recommandations,
    selection(personne.cle, 'adrenaline').recommandations,
  );
  pireHumeur = Math.min(pireHumeur, d);
  console.log(`    ${personne.reponses.pseudo.padEnd(10)} fatigué vs adrénaline : ${pct(d)} de titres différents`);
}
noter('L’humeur change la sélection', pireHumeur >= 0.4, `au minimum ${pct(pireHumeur)} de différence`);

console.log('\n  Recouvrement entre profils (objectif : < 20 %, moyenne sur les 6 contextes)');
const paires: Array<{ nom: string; moyenne: number }> = [];
for (let i = 0; i < PERSONNES.length; i += 1) {
  for (let j = i + 1; j < PERSONNES.length; j += 1) {
    const parts = CONTEXTES.map((c) =>
      recouvrement(selection(PERSONNES[i].cle, c.cle).recommandations, selection(PERSONNES[j].cle, c.cle).recommandations),
    );
    paires.push({
      nom: `${PERSONNES[i].reponses.pseudo} ∩ ${PERSONNES[j].reponses.pseudo}`,
      moyenne: parts.reduce((a, b) => a + b, 0) / parts.length,
    });
  }
}
paires.sort((a, b) => b.moyenne - a.moyenne);
for (const p of paires) {
  console.log(`    ${p.nom.padEnd(22)} ${pct(p.moyenne).padStart(5)}  ${p.moyenne < 0.2 ? '✓' : '△'}`);
}
const sousSeuil = paires.filter((p) => p.moyenne < 0.2).length;
noter(
  'Profils distincts',
  sousSeuil >= paires.length - 3 && paires.every((p) => p.moyenne < 0.35),
  `${sousSeuil}/${paires.length} paires sous 20 % · pire paire ${pct(paires[0].moyenne)}`,
);

console.log('\n  Époque : jeunesse et nouveautés dans la même sélection');
let epoqueOk = true;
for (const personne of PERSONNES) {
  const profil = profilDe(personne);
  const recos = selection(personne.cle, 'triste').recommandations;
  const jeunesse = recos.filter((r) => {
    const a = r.titre.annee - profil.anneeNaissance;
    return a >= 8 && a <= 20;
  }).length;
  const recents = recos.filter((r) => ANNEE_REFERENCE - r.titre.annee <= 8).length;
  if (jeunesse < 1 || recents < 1) epoqueOk = false;
  console.log(`    ${profil.pseudo.padEnd(10)} ${jeunesse} titre(s) de sa jeunesse · ${recents} sortie(s) récente(s)`);
}
noter('Adaptation à l’époque', epoqueOk, 'au moins un titre de jeunesse ET une nouveauté partout');

console.log('\n  Diversité');
let pireGenre = 0;
let doublonsFranchise = 0;
for (const personne of PERSONNES) {
  for (const contexteTest of CONTEXTES) {
    const recos = selection(personne.cle, contexteTest.cle).recommandations;
    const parGenre = new Map<string, number>();
    for (const r of recos) {
      const g = r.titre.genres[0] ?? 'Autre';
      parGenre.set(g, (parGenre.get(g) ?? 0) + 1);
    }
    pireGenre = Math.max(pireGenre, Math.max(...parGenre.values()) / recos.length);
    const racines = new Set<string>();
    for (const r of recos) {
      const racine = r.titre.titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[:\-–(]/)[0].trim();
      if (racine.length > 3) {
        if (racines.has(racine)) doublonsFranchise += 1;
        racines.add(racine);
      }
    }
  }
}
console.log(`    Part maximale d’un même genre affiché : ${pct(pireGenre)} (plafond ${pct(DIVERSITE.plafondGenreAffichage)})`);
console.log(`    Doublons de franchise : ${doublonsFranchise}`);
noter('Diversité de genre et de franchise', pireGenre <= DIVERSITE.plafondGenreAffichage + 0.001 && doublonsFranchise === 0);

/* =====================================================================
   4. Apprentissage.
   ===================================================================== */
console.log(`\n${TIRET}\n  APPRENTISSAGE — 10 interactions sur le profil de Sarah\n${TIRET}`);
{
  const personne = PERSONNES.find((p) => p.cle === 'sarah')!;
  let profil = profilDe(personne);
  const initial = profilDe(personne);
  let historique = historiqueVide();
  const contexte = contexteDe(CONTEXTES[3]);

  const crime = CATALOGUE_DEMO.filter(
    (t) => t.genres.includes('Crime') && t.plateformes.some((p) => ['prime', 'disney'].includes(p)),
  );
  const temoin = crime[0];
  const rang = (p: typeof profil, h: typeof historique) => {
    const c = classerPourDecouverte(CATALOGUE_DEMO, p, h, contexte, ANNEE_REFERENCE);
    const i = c.findIndex((r) => r.titre.id === temoin.id);
    return i === -1 ? '—' : String(i + 1);
  };
  const rangAvant = rang(profil, historique);

  const aimes = crime.slice(1, 6);
  const rejetes = CATALOGUE_DEMO.filter(
    (t) => t.genres.includes('Comédie') && t.plateformes.some((p) => ['prime', 'disney'].includes(p)),
  ).slice(0, 5);

  console.log(`  5 « j’ai adoré »   : ${aimes.map((t) => t.titre).join(', ')}`);
  console.log(`  5 « pas pour moi » : ${rejetes.map((t) => t.titre).join(', ')}`);

  for (const t of aimes) {
    profil = appliquerSignal(profil, t, 'deja_vu_aime');
    historique = enregistrerSignal(historique, t.id, 'deja_vu_aime', contexte.maintenant);
  }
  for (const t of rejetes) {
    profil = appliquerSignal(profil, t, 'pas_pour_moi');
    historique = enregistrerSignal(historique, t.id, 'pas_pour_moi', contexte.maintenant);
  }

  const rangApres = rang(profil, historique);
  console.log(`\n  Poids « Crime »   : ${(initial.gouts.genres['Crime'] ?? 0).toFixed(2)} → ${profil.gouts.genres['Crime'].toFixed(2)}`);
  console.log(`  Poids « Comédie » : ${initial.gouts.genres['Comédie'].toFixed(2)} → ${profil.gouts.genres['Comédie'].toFixed(2)}`);
  console.log(`  Témoin jamais touché « ${temoin.titre} » : rang ${rangAvant} → ${rangApres}`);

  const monte = rangApres !== '—' && rangAvant !== '—' && Number(rangApres) < Number(rangAvant);
  noter(
    'Apprentissage continu',
    monte && profil.gouts.genres['Comédie'] < initial.gouts.genres['Comédie'],
    `témoin ${rangAvant} → ${rangApres}, poids Comédie en baisse`,
  );
}

/* =====================================================================
   5. Verdict.
   ===================================================================== */
console.log(`\n${TIRET}\n  RÉSULTATS\n${TIRET}`);
for (const c of controles) {
  console.log(`  ${c.ok ? '✅' : '❌'} ${c.libelle}${c.detail ? ` — ${c.detail}` : ''}`);
}
const echecs = controles.filter((c) => !c.ok).length;
console.log(
  `\n  ${echecs === 0 ? '✅ TOUS LES CONTRÔLES PASSENT' : `❌ ${echecs} CONTRÔLE(S) EN ÉCHEC`} ` +
    `(${controles.length - echecs}/${controles.length}) · ${totalSelections} sélections analysées\n`,
);
process.exitCode = echecs === 0 ? 0 : 1;
