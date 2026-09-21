/* =====================================================================
   audit-mobile.mjs — Contrôle statique des règles iPhone.
   ---------------------------------------------------------------------
   Ce script ne remplace PAS un test sur appareil : il vérifie dans le
   code les erreurs qui cassent silencieusement une PWA sur Safari iOS,
   et qu'on ne voit qu'une fois le téléphone en main.

   Lancer :  npm run audit:mobile
   ===================================================================== */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const racine = new URL('..', import.meta.url).pathname;
const src = join(racine, 'src');

const fichiers = [];
(function parcourir(dossier) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) parcourir(chemin);
    else if (/\.(tsx|ts|css)$/.test(e.name)) fichiers.push(chemin);
  }
})(src);

const problemes = [];
const reussites = [];
const signaler = (fichier, ligne, message) =>
  problemes.push(`${relative(racine, fichier)}:${ligne} — ${message}`);

/* ---------------------------------------------------------------------
   1. Champs de saisie : Safari zoome dès que la police passe sous 16 px.
   --------------------------------------------------------------------- */
const TAILLES_SURES = /text-\[(1[6-9]|[2-9]\d)px\]|text-(base|lg|xl|2xl|3xl)/;
let champs = 0;
let champsSurs = 0;

for (const fichier of fichiers.filter((f) => f.endsWith('.tsx'))) {
  const lignes = readFileSync(fichier, 'utf8').split('\n');
  lignes.forEach((ligne, i) => {
    if (!/<(input|textarea|select)\b/.test(ligne)) return;
    champs += 1;
    // La classe peut être sur les lignes suivantes (JSX multiligne).
    const bloc = lignes.slice(i, i + 16).join(' ');
    if (TAILLES_SURES.test(bloc)) champsSurs += 1;
    else signaler(fichier, i + 1, 'champ de saisie sans police ≥ 16 px → Safari zoomera');
  });
}
if (champs > 0 && champs === champsSurs) {
  reussites.push(`${champs} champs de saisie, tous en police ≥ 16 px (pas de zoom Safari)`);
}

// Filet de sécurité global dans la feuille de style.
const globals = readFileSync(join(src, 'app/globals.css'), 'utf8');
if (/input[\s\S]{0,120}font-size:\s*max\(16px/.test(globals)) {
  reussites.push('globals.css impose en plus un plancher de 16 px sur tous les champs');
} else {
  problemes.push('globals.css — pas de plancher global de 16 px sur les champs');
}

/* ---------------------------------------------------------------------
   2. Cibles tactiles : 44 px minimum (recommandation Apple).
   --------------------------------------------------------------------- */
if (/button[\s\S]{0,160}min-height:\s*44px/.test(globals)) {
  reussites.push('globals.css impose 44 px de hauteur minimale aux boutons et liens-boutons');
} else {
  problemes.push('globals.css — pas de hauteur minimale de 44 px sur les cibles tactiles');
}

// Une hauteur explicite plus petite annulerait la règle globale.
for (const fichier of fichiers.filter((f) => f.endsWith('.tsx'))) {
  readFileSync(fichier, 'utf8')
    .split('\n')
    .forEach((ligne, i) => {
      const m = ligne.match(/\b(?:min-)?h-\[(\d+)px\]/g) ?? [];
      for (const trouve of m) {
        const px = Number(trouve.match(/(\d+)px/)[1]);
        if (px < 44 && /<(button|a)\b|Bouton|Puce/.test(ligne)) {
          signaler(fichier, i + 1, `cible tactile de ${px} px (< 44 px)`);
        }
      }
    });
}

/* ---------------------------------------------------------------------
   3. Zones sûres : encoche en haut, barre d'accueil en bas.
   --------------------------------------------------------------------- */
for (const fichier of fichiers.filter((f) => f.endsWith('.tsx'))) {
  const contenu = readFileSync(fichier, 'utf8');
  const lignes = contenu.split('\n');
  lignes.forEach((ligne, i) => {
    // Un élément collé en bas doit tenir compte de la zone sûre.
    if (/fixed[^"'`]*\binset-x-0\b[^"'`]*\bbottom-0\b/.test(ligne)) {
      const bloc = lignes.slice(Math.max(0, i - 3), i + 14).join(' ');
      if (!/safe-area-inset-bottom|zone-sure-bas|--hauteur-onglets/.test(bloc)) {
        signaler(fichier, i + 1, 'élément fixé en bas sans zone sûre iOS');
      }
    }
  });
}
if (/env\(safe-area-inset-top\)/.test(globals) && /env\(safe-area-inset-bottom\)/.test(globals)) {
  reussites.push('globals.css déclare les zones sûres haut et bas');
}

/* ---------------------------------------------------------------------
   4. Fenêtre d'affichage.
   --------------------------------------------------------------------- */
const layout = readFileSync(join(src, 'app/layout.tsx'), 'utf8');
if (/viewportFit:\s*'cover'/.test(layout)) {
  reussites.push("viewportFit: 'cover' — les zones sûres sont exploitables");
} else {
  problemes.push('layout.tsx — viewportFit « cover » absent : les zones sûres seront ignorées');
}
if (/userScalable:\s*false|maximumScale:\s*1\b/.test(layout)) {
  problemes.push('layout.tsx — le zoom manuel est désactivé (problème d’accessibilité)');
} else {
  reussites.push('le zoom manuel reste autorisé (accessibilité)');
}

/* ---------------------------------------------------------------------
   5. Débordement horizontal à 390 px.
   --------------------------------------------------------------------- */
if (/overflow-x:\s*hidden/.test(globals)) {
  reussites.push('globals.css bloque le débordement horizontal du body');
}
for (const fichier of fichiers.filter((f) => f.endsWith('.tsx'))) {
  readFileSync(fichier, 'utf8')
    .split('\n')
    .forEach((ligne, i) => {
      const m = ligne.match(/\bw-\[(\d+)px\]/g) ?? [];
      for (const trouve of m) {
        const px = Number(trouve.match(/(\d+)px/)[1]);
        // 390 px moins les marges latérales de 20 px.
        if (px > 350) signaler(fichier, i + 1, `largeur fixe de ${px} px, trop large pour un iPhone (390 px)`);
      }
    });
}

/* ---------------------------------------------------------------------
   6. Lecture vidéo en ligne (sinon Safari sort de l'app).
   --------------------------------------------------------------------- */
const lecteur = readFileSync(join(src, 'components/LecteurBandeAnnonce.tsx'), 'utf8');
if (/playsinline=1/.test(lecteur)) reussites.push('le lecteur de bande-annonce reste dans l’app (playsinline)');
else problemes.push('LecteurBandeAnnonce — « playsinline » absent : iOS ouvrira le lecteur système');
if (/autoplay=1/.test(lecteur)) reussites.push('la bande-annonce démarre en un seul appui (autoplay)');
if (/document\.body\.style\.overflow/.test(lecteur)) {
  reussites.push('le défilement de la page est bloqué pendant la lecture');
}

/* ---------------------------------------------------------------------
   7. Accessibilité de base.
   --------------------------------------------------------------------- */
for (const fichier of fichiers.filter((f) => f.endsWith('.tsx'))) {
  readFileSync(fichier, 'utf8')
    .split('\n')
    .forEach((ligne, i) => {
      if (/<Image\b/.test(ligne)) {
        const bloc = readFileSync(fichier, 'utf8').split('\n').slice(i, i + 10).join(' ');
        if (!/alt=/.test(bloc)) signaler(fichier, i + 1, 'image sans texte alternatif');
      }
    });
}
if (/prefers-reduced-motion/.test(globals)) {
  reussites.push('le réglage iOS « Réduire les animations » est respecté');
}

/* ---------------------------------------------------------------------
   8. PWA.
   --------------------------------------------------------------------- */
const manifeste = JSON.parse(readFileSync(join(racine, 'public/manifest.webmanifest'), 'utf8'));
for (const cle of ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color']) {
  if (!manifeste[cle]) problemes.push(`manifest.webmanifest — champ « ${cle} » manquant`);
}
if (manifeste.display === 'standalone') reussites.push('manifeste en mode « standalone » (plein écran depuis l’icône)');
if (manifeste.icons?.some((i) => i.purpose === 'maskable')) reussites.push('icône maskable fournie');
if (/apple-touch-startup-image/.test(readFileSync(join(src, 'components/ReglagesPWA.tsx'), 'utf8'))) {
  reussites.push('écrans de lancement iOS déclarés');
}

/* ---------------------------------------------------------------------
   Verdict.
   --------------------------------------------------------------------- */
console.log('\n' + '─'.repeat(74));
console.log('  AUDIT MOBILE — règles Safari iOS / iPhone 390 px');
console.log('─'.repeat(74) + '\n');
for (const r of reussites) console.log(`  ✅ ${r}`);
if (problemes.length > 0) {
  console.log('');
  for (const p of problemes) console.log(`  ❌ ${p}`);
}
console.log(
  `\n  ${problemes.length === 0 ? '✅ Aucun problème détecté' : `❌ ${problemes.length} problème(s)`} ` +
    `· ${reussites.length} contrôle(s) réussi(s)\n`,
);
console.log('  ⚠ Cet audit est statique. Le rendu réel doit être vérifié sur un iPhone,');
console.log('    avec la checklist de DEPLOIEMENT.md.\n');
process.exitCode = problemes.length === 0 ? 0 : 1;
