/* =====================================================================
   generer-icones.mjs — Fabrique les icônes et écrans de lancement PWA.
   ---------------------------------------------------------------------
   Aucune dépendance : l'image est calculée pixel par pixel, puis
   encodée en PNG avec le module `zlib` de Node. On peut donc régénérer
   les assets n'importe où, sans chaîne de build graphique.

   Lancer :  node scripts/generer-icones.mjs
   ===================================================================== */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, '..', 'public', 'icons');

/* --- Palette, alignée sur tailwind.config.ts ----------------------- */
const NUIT = [6, 4, 11];
const VIOLET_CLAIR = [164, 107, 255];
const VIOLET = [123, 44, 255];
const ROSE = [255, 46, 147];

/* =====================================================================
   1. Encodeur PNG minimal (RGBA, 8 bits, non entrelacé).
   ===================================================================== */
function crc32(donnees) {
  let c = ~0;
  for (let i = 0; i < donnees.length; i += 1) {
    c ^= donnees[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function morceau(type, donnees) {
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(donnees.length, 0);
  entete.write(type, 4, 'ascii');
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const fin = Buffer.alloc(4);
  fin.writeUInt32BE(crc32(corps), 0);
  return Buffer.concat([entete.subarray(0, 8), donnees, fin]);
}

function encoderPng(largeur, hauteur, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  // Une ligne = 1 octet de filtre (0 = aucun) + largeur × 4 octets.
  const brut = Buffer.alloc(hauteur * (largeur * 4 + 1));
  for (let y = 0; y < hauteur; y += 1) {
    const depart = y * (largeur * 4 + 1);
    brut[depart] = 0;
    pixels.copy(brut, depart + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', deflateSync(brut, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

/* =====================================================================
   2. Rendu du logo : un obturateur violet-rose sur fond nuit.
   ===================================================================== */
const melanger = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));

/**
 * Couleur du logo au point (u, v) normalisé dans [-1, 1].
 * Renvoie `null` en dehors du disque : le fond reste visible.
 */
function couleurLogo(u, v, epaisseurAnneau = 0.075) {
  const rayon = Math.hypot(u, v);
  if (rayon > 1) return null;

  // Dégradé diagonal, comme le SVG de la vitrine.
  const t = (u + v + 2) / 4;
  const teinte = t < 0.5 ? melanger(VIOLET_CLAIR, VIOLET, t * 2) : melanger(VIOLET, ROSE, (t - 0.5) * 2);

  // Anneau extérieur.
  if (rayon > 1 - epaisseurAnneau) return { couleur: teinte, alpha: 1 };

  // Moyeu sombre au centre.
  if (rayon < 0.26) return { couleur: NUIT, alpha: 1 };

  // Six pales, d'opacité croissante : l'obturateur en rotation.
  const angle = (Math.atan2(v, u) + Math.PI * 2) % (Math.PI * 2);
  const secteur = Math.floor((angle / (Math.PI * 2)) * 6);
  const dansLaPale = ((angle / (Math.PI * 2)) * 6) % 1 < 0.84;
  if (!dansLaPale) return null;

  return { couleur: teinte, alpha: 0.5 + (secteur / 6) * 0.5 };
}

/**
 * Dessine une image. `proportionLogo` = part de la largeur occupée par
 * le logo ; `coinsArrondis` sert aux icônes non maskables.
 */
function dessiner(largeur, hauteur, { proportionLogo = 0.64, fond = NUIT, arrondi = 0 } = {}) {
  const pixels = Buffer.alloc(largeur * hauteur * 4);
  const centreX = largeur / 2;
  const centreY = hauteur / 2;
  const rayonLogo = (Math.min(largeur, hauteur) * proportionLogo) / 2;
  // Échantillonnage 2×2 : des bords nets sans bibliothèque graphique.
  const SOUS = 2;

  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SOUS; sy += 1) {
        for (let sx = 0; sx < SOUS; sx += 1) {
          const px = x + (sx + 0.5) / SOUS;
          const py = y + (sy + 0.5) / SOUS;

          // Fond, avec une lueur dorée très légère vers le haut.
          const lueur = Math.max(0, 1 - Math.hypot((px - centreX) / largeur, (py) / hauteur) * 2.2);
          let couleur = melanger(fond, VIOLET, lueur * 0.16);
          let alpha = 1;

          // Coins arrondis (icône classique iOS).
          if (arrondi > 0) {
            const dx = Math.max(arrondi - px, px - (largeur - arrondi), 0);
            const dy = Math.max(arrondi - py, py - (hauteur - arrondi), 0);
            if (Math.hypot(dx, dy) > arrondi) alpha = 0;
          }

          const logo = couleurLogo((px - centreX) / rayonLogo, (py - centreY) / rayonLogo);
          if (logo) couleur = melanger(couleur, logo.couleur, logo.alpha);

          r += couleur[0] * alpha;
          g += couleur[1] * alpha;
          b += couleur[2] * alpha;
          a += 255 * alpha;
        }
      }

      const n = SOUS * SOUS;
      const i = (y * largeur + x) * 4;
      pixels[i] = Math.round(r / n);
      pixels[i + 1] = Math.round(g / n);
      pixels[i + 2] = Math.round(b / n);
      pixels[i + 3] = Math.round(a / n);
    }
  }

  return encoderPng(largeur, hauteur, pixels);
}

/* =====================================================================
   3. Génération.
   ===================================================================== */
mkdirSync(SORTIE, { recursive: true });

const ICONES = [
  { fichier: 'favicon-32.png', taille: 32, options: { proportionLogo: 0.86 } },
  { fichier: 'icone-180.png', taille: 180, options: { proportionLogo: 0.7, arrondi: 40 } },
  { fichier: 'icone-192.png', taille: 192, options: { proportionLogo: 0.7 } },
  { fichier: 'icone-512.png', taille: 512, options: { proportionLogo: 0.7 } },
  // Maskable : le logo doit tenir dans la « safe zone » de 80 %.
  { fichier: 'icone-maskable-512.png', taille: 512, options: { proportionLogo: 0.52 } },
];

for (const { fichier, taille, options } of ICONES) {
  writeFileSync(join(SORTIE, fichier), dessiner(taille, taille, options));
  console.log(`  ✓ ${fichier} (${taille}×${taille})`);
}

// Écrans de lancement iOS, pour les tailles d'iPhone les plus courantes.
const LANCEMENTS = [
  [1290, 2796], // iPhone 15/16 Pro Max
  [1179, 2556], // iPhone 15/16 Pro
  [1170, 2532], // iPhone 12/13/14
  [750, 1334], // iPhone SE
];

for (const [l, h] of LANCEMENTS) {
  writeFileSync(join(SORTIE, `lancement-${l}x${h}.png`), dessiner(l, h, { proportionLogo: 0.34 }));
  console.log(`  ✓ lancement-${l}x${h}.png`);
}

// Version vectorielle, utilisée par les navigateurs modernes.
writeFileSync(
  join(SORTIE, 'icone.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="CinéMood">
  <defs>
    <linearGradient id="marque" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#A46BFF"/><stop offset="55%" stop-color="#7B2CFF"/><stop offset="100%" stop-color="#FF2E93"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#06040B"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="url(#marque)" stroke-width="14"/>
  ${[0, 60, 120, 180, 240, 300]
    .map(
      (angle) =>
        `<path d="M256 256 L256 100 A156 156 0 0 1 391 178 Z" fill="url(#marque)" opacity="${(
          0.16 +
          (angle / 360) * 0.5
        ).toFixed(2)}" transform="rotate(${angle} 256 256)"/>`,
    )
    .join('\n  ')}
  <circle cx="256" cy="256" r="44" fill="#06040B"/>
</svg>
`,
);
console.log('  ✓ icone.svg');
console.log('\nIcônes générées dans public/icons.');
