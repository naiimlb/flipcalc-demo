'use client';

/* =====================================================================
   Boutons.tsx — Les trois boutons de l'app, et rien de plus.
   Toutes les cibles font au moins 44 px de haut (recommandation Apple).
   ===================================================================== */

import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

type Variante = 'accent' | 'verre' | 'fantome';

interface Props extends HTMLMotionProps<'button'> {
  variante?: Variante;
  pleineLargeur?: boolean;
  children: ReactNode;
}

const STYLES: Record<Variante, string> = {
  accent: 'bg-voile-accent text-white font-semibold shadow-accent',
  verre: 'verre text-ivoire font-medium',
  fantome: 'text-cendre font-medium',
};

export function Bouton({
  variante = 'verre',
  pleineLargeur = false,
  className = '',
  children,
  ...reste
}: Props) {
  return (
    <motion.button
      // Micro-animation au toucher : l'app doit « répondre » sous le doigt.
      whileTap={{ scale: 0.965 }}
      transition={{ type: 'spring', stiffness: 460, damping: 28 }}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-douce px-5 text-[15px] transition-opacity active:opacity-90 disabled:opacity-40 ${
        STYLES[variante]
      } ${pleineLargeur ? 'w-full' : ''} ${className}`}
      {...reste}
    >
      {children}
    </motion.button>
  );
}

/** Petite action ronde : cœur, pouce, croix… */
export function BoutonRond({
  libelle,
  actif = false,
  className = '',
  children,
  ...reste
}: HTMLMotionProps<'button'> & { libelle: string; actif?: boolean; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      aria-label={libelle}
      aria-pressed={actif}
      className={`flex h-[46px] w-[46px] items-center justify-center rounded-full transition-colors ${
        actif ? 'bg-accent text-white' : 'verre text-ivoire'
      } ${className}`}
      {...reste}
    >
      {children}
    </motion.button>
  );
}

/** Puce de sélection (genres, filtres, options du test). */
export function Puce({
  actif = false,
  className = '',
  children,
  ...reste
}: HTMLMotionProps<'button'> & { actif?: boolean; children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      aria-pressed={actif}
      className={`min-h-[44px] rounded-full border px-4 text-[15px] transition-colors ${
        actif
          ? 'border-accent/70 bg-accent/15 text-ivoire'
          : 'border-white/10 bg-white/[0.035] text-cendre'
      } ${className}`}
      {...reste}
    >
      {children}
    </motion.button>
  );
}
