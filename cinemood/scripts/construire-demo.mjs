/* =====================================================================
   construire-demo.mjs — Fabrique la version statique de CinéMood.
   ---------------------------------------------------------------------
   Pourquoi cette version existe. L'app Next.js est la version de
   production : elle parle à TMDB et à Supabase depuis le serveur. Mais
   elle a besoin d'un hébergeur qui exécute du code. Le dépôt, lui,
   publie déjà des pages statiques sur GitHub Pages — d'où cette build
   statique, ouvrable immédiatement sur un iPhone, qui fait tourner
   EXACTEMENT le même moteur de recommandation sur le catalogue local.

   Le moteur (`src/lib/reco/`) est du TypeScript sans aucune dépendance :
   Node sait en retirer les types, ce qui donne des modules ES lisibles
   directement par le navigateur. Aucune duplication de logique : si le
   moteur change, cette build change avec lui.

   Lancer :  npm run construire:demo
   ===================================================================== */

import { stripTypeScriptTypes } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const APP = join(ICI, '..');
const DEMO = join(APP, '..', 'cinemood-demo');

const MODULES = [
  ['src/lib/reco/types.ts', 'types.js'],
  ['src/lib/reco/poids.ts', 'poids.js'],
  ['src/lib/reco/plateformes.ts', 'plateformes.js'],
  ['src/lib/reco/profil.ts', 'profil.js'],
  ['src/lib/reco/epoque.ts', 'epoque.js'],
  ['src/lib/reco/humeur.ts', 'humeur.js'],
  ['src/lib/reco/score.ts', 'score.js'],
  ['src/lib/reco/diversite.ts', 'diversite.js'],
  ['src/lib/reco/explication.ts', 'explication.js'],
  ['src/lib/reco/moteur.ts', 'moteur.js'],
  ['src/data/catalogue-demo.ts', 'catalogue.js'],
];

const ENTETE = `/* Généré par scripts/construire-demo.mjs — NE PAS MODIFIER À LA MAIN.
   Source : cinemood/%SOURCE%
   Les types TypeScript ont été retirés ; la logique est identique. */\n\n`;

mkdirSync(join(DEMO, 'moteur'), { recursive: true });

let total = 0;
for (const [source, cible] of MODULES) {
  const brut = readFileSync(join(APP, source), 'utf8');
  let js = stripTypeScriptTypes(brut, { mode: 'strip' });

  // Le navigateur exige des chemins complets : « ./poids.ts » → « ./poids.js ».
  js = js.replace(/(from\s+['"])(\.\/[\w-]+)\.ts(['"])/g, '$1$2.js$3');
  // Le catalogue importe ses types par alias ; l'import est déjà effacé,
  // mais on refuse toute autre référence non résolue au navigateur.
  if (/from\s+['"]@\//.test(js)) {
    throw new Error(`${source} garde un import par alias, irrésoluble dans le navigateur`);
  }

  const sortie = ENTETE.replace('%SOURCE%', source) + js;
  writeFileSync(join(DEMO, 'moteur', cible), sortie);
  total += sortie.length;
  console.log(`  ✓ ${cible.padEnd(16)} ${String(sortie.length).padStart(7)} octets`);
}

// Les icônes et le manifeste sont partagés avec l'app Next.js.
mkdirSync(join(DEMO, 'icons'), { recursive: true });
for (const fichier of [
  'icone.svg',
  'icone-180.png',
  'icone-192.png',
  'icone-512.png',
  'icone-maskable-512.png',
  'favicon-32.png',
  'lancement-1290x2796.png',
  'lancement-1179x2556.png',
  'lancement-1170x2532.png',
  'lancement-750x1334.png',
]) {
  copyFileSync(join(APP, 'public/icons', fichier), join(DEMO, 'icons', fichier));
}
console.log(`  ✓ icônes et écrans de lancement copiés`);

console.log(`\n  Moteur porté : ${(total / 1024).toFixed(0)} Ko de JavaScript, zéro dépendance.\n`);
