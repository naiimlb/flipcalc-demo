'use client';

/* =====================================================================
   TirerPourActualiser.tsx — Le geste « tirer vers le bas pour recharger ».
   ---------------------------------------------------------------------
   Safari iOS n'offre pas ce geste dans une PWA installée : on l'écrit
   donc à la main. Il ne se déclenche que si la page est déjà tout en
   haut, pour ne jamais gêner le défilement normal.
   ===================================================================== */

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';

const SEUIL = 78;
const RESISTANCE = 2.1;

export function TirerPourActualiser({
  onActualiser,
  children,
}: {
  onActualiser: () => Promise<void> | void;
  children: ReactNode;
}) {
  const [enCours, setEnCours] = useState(false);
  const depart = useRef<number | null>(null);
  const tire = useMotionValue(0);
  const opacite = useTransform(tire, [0, SEUIL], [0, 1]);
  const rotation = useTransform(tire, [0, SEUIL * 2], [0, 360]);

  function auDebut(e: React.TouchEvent) {
    if (window.scrollY > 2 || enCours) return;
    depart.current = e.touches[0].clientY;
  }

  function auMouvement(e: React.TouchEvent) {
    if (depart.current === null) return;
    const delta = e.touches[0].clientY - depart.current;
    if (delta <= 0) {
      tire.set(0);
      return;
    }
    tire.set(Math.min(SEUIL * 1.6, delta / RESISTANCE));
  }

  async function aLaFin() {
    const distance = tire.get();
    depart.current = null;
    if (distance >= SEUIL && !enCours) {
      setEnCours(true);
      tire.set(SEUIL * 0.6);
      try {
        await onActualiser();
      } finally {
        setEnCours(false);
        tire.set(0);
      }
    } else {
      tire.set(0);
    }
  }

  return (
    <div onTouchStart={auDebut} onTouchMove={auMouvement} onTouchEnd={aLaFin} onTouchCancel={aLaFin}>
      <motion.div
        style={{ height: tire, opacity: opacite }}
        className="flex items-end justify-center overflow-hidden"
        aria-hidden={!enCours}
      >
        <motion.span
          style={{ rotate: rotation }}
          className={`mb-2 inline-block h-6 w-6 rounded-full border-2 border-or/30 border-t-or ${
            enCours ? 'animate-spin' : ''
          }`}
        />
      </motion.div>
      <motion.div style={{ y: tire }}>{children}</motion.div>
    </div>
  );
}
