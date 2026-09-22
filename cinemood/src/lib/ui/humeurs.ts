/* =====================================================================
   humeurs.ts — L'identité visuelle de chaque humeur.
   ---------------------------------------------------------------------
   Une humeur n'est pas qu'une entrée dans une table de pondérations :
   c'est une couleur qui teinte tout l'écran, et une icône dessinée.

   Ce fichier est la SOURCE UNIQUE de ces deux choses. Il ne dépend de
   rien (aucun import de valeur), ce qui permet au script de build de la
   démo statique de le porter tel quel dans le navigateur : l'app Next.js
   et la démo ne peuvent donc pas diverger.

   Les couleurs sont données en composantes RGB séparées par des espaces,
   pour être injectées dans des variables CSS et réutilisées avec une
   opacité variable : rgb(var(--accent) / 0.4).
   ===================================================================== */

import type { Humeur } from '@/lib/reco/types';

export interface IdentiteHumeur {
  /** Accent principal, « R G B ». Teinte le halo, la bordure, le bouton. */
  accent: string;
  /** Seconde couleur du dégradé de la carte, « R G B ». */
  second: string;
  /** Tracé de l'icône, dessiné sur une grille de 24 × 24. */
  icone: string;
}

/**
 * Neuf humeurs, neuf teintes réparties sur la roue chromatique : deux
 * humeurs voisines dans la liste ne doivent jamais se confondre d'un
 * coup d'œil, même en petit format.
 */
export const IDENTITE_HUMEUR: Record<Humeur, IdentiteHumeur> = {
  adrenaline: {
    accent: '255 59 31',
    second: '255 138 29',
    icone: 'M13.2 2.6 5.4 13.2h4.9l-1.3 8.2 7.8-10.9h-4.9l1.3-7.9Z',
  },
  joyeux: {
    accent: '255 159 28',
    second: '255 206 92',
    icone: 'M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8M12 2.6v2.1M12 19.3v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5',
  },
  rire: {
    accent: '255 203 43',
    second: '255 236 130',
    icone: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M7.4 13.2a4.7 4.7 0 0 0 9.2 0ZM8.4 9.2c.4-.9 1.3-.9 1.7 0M13.9 9.2c.4-.9 1.3-.9 1.7 0',
  },
  evasion: {
    accent: '18 200 192',
    second: '78 220 150',
    icone: 'M2.8 18.9h18.4M5.2 18.9 10 10.4l3.5 5.5M12.5 18.9l4-6.7 4.3 6.7M16.8 7.9a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z',
  },
  triste: {
    accent: '76 125 255',
    second: '120 170 255',
    icone: 'M12 3.3c3.3 3.9 5.6 6.8 5.6 9.6a5.6 5.6 0 1 1-11.2 0c0-2.8 2.3-5.7 5.6-9.6Z',
  },
  reflexion: {
    accent: '59 69 232',
    second: '128 90 245',
    icone: 'M12 12.7a1.7 1.7 0 1 1 1.7-1.7c0 1.9-1.9 2.8-3.6 2.8s-3.4-1.4-3.4-3.7S8.8 5.8 12 5.8s5.8 2.4 5.8 5.5-2.3 6-5.8 7',
  },
  fatigue: {
    accent: '139 123 240',
    second: '186 150 255',
    icone: 'M20.4 14.3A8.7 8.7 0 0 1 9.7 3.6 8.7 8.7 0 1 0 20.4 14.3Z',
  },
  frisson: {
    accent: '176 38 255',
    second: '255 46 147',
    icone: 'M6.4 3.4c1.7 4.5 2.5 10.1 2.3 17.2M11.9 2.7c1.7 4.7 2.6 10.5 2.4 17.9M17.4 4.5c1.4 4 2 8.9 1.9 15.3',
  },
  romantique: {
    accent: '255 46 147',
    second: '176 38 255',
    icone: 'M12 20.4s-7.4-4.5-7.4-9.6A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 7.4 2.7c0 5.1-7.4 9.6-7.4 9.6Z',
  },
};

/** L'accent utilisé quand aucune humeur n'est choisie : celui de la marque. */
export const ACCENT_MARQUE = '123 44 255';
export const SECOND_MARQUE = '255 46 147';

/** Les composantes d'accent à poser sur un conteneur, humeur ou non. */
export function accentDe(humeur: Humeur | null): { accent: string; second: string } {
  if (!humeur) return { accent: ACCENT_MARQUE, second: SECOND_MARQUE };
  const identite = IDENTITE_HUMEUR[humeur];
  return { accent: identite.accent, second: identite.second };
}
