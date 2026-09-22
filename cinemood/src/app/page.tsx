'use client';

/* =====================================================================
   Page d'accueil publique — la vitrine avant connexion.
   ---------------------------------------------------------------------
   Elle doit donner l'impression d'un service soigné en trois secondes :
   un titre, une promesse, un bouton. Rien d'autre à l'écran.
   ===================================================================== */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

import { useApp } from '@/lib/etat/magasin';
import { SUPABASE_CONFIGURE } from '@/lib/supabase/config';

const ARGUMENTS = [
  {
    titre: 'Tes plateformes, uniquement',
    texte: 'Jamais un titre que tu ne peux pas lancer dans la minute.',
  },
  {
    titre: 'Ton humeur du soir',
    texte: 'Fatigué, remonté à bloc, besoin de rire : la sélection change vraiment.',
  },
  {
    titre: 'Ta génération',
    texte: 'Ce qui est sorti quand tu avais quinze ans compte autant que les nouveautés.',
  },
];

export default function PageVitrine() {
  const { pret, plateformesChoisies, testTermine } = useApp();
  const routeur = useRouter();

  // Quelqu'un qui a déjà tout configuré n'a rien à faire sur la vitrine.
  useEffect(() => {
    if (pret && plateformesChoisies && testTermine) routeur.replace('/accueil');
  }, [pret, plateformesChoisies, testTermine, routeur]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-lueur" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-xl flex-col px-7">
        {/* --- Logo ---------------------------------------------------- */}
        <header className="zone-sure-haut pt-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-titre text-[1.4rem] tracking-wide text-ivoire">
              Ciné<span className="texte-or">Mood</span>
            </span>
          </div>
        </header>

        {/* --- Promesse ------------------------------------------------ */}
        <section className="flex flex-1 flex-col justify-center py-14">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="equilibre font-titre text-[3.2rem] font-light leading-[1.02] text-ivoire"
          >
            Arrête de chercher.
            <br />
            <span className="texte-or">Commence à regarder.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}
            className="mt-6 max-w-md text-[16px] leading-relaxed text-cendre"
          >
            CinéMood choisit pour toi un film ou une série, selon ton humeur du moment, ce que tu as
            aimé jusqu’ici et les plateformes auxquelles tu es réellement abonné.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-10 space-y-5"
          >
            {ARGUMENTS.map((argument) => (
              <li key={argument.titre} className="flex gap-4">
                <span className="mt-2 h-px w-7 shrink-0 bg-voile-or" aria-hidden="true" />
                <div>
                  <p className="text-[15px] font-medium text-ivoire">{argument.titre}</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-estompe">{argument.texte}</p>
                </div>
              </li>
            ))}
          </motion.ul>
        </section>

        {/* --- Appel à l'action ---------------------------------------- */}
        <footer className="zone-sure-bas pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link
              href={SUPABASE_CONFIGURE ? '/connexion' : '/bienvenue/plateformes'}
              className="flex min-h-[56px] w-full items-center justify-center rounded-douce bg-voile-or text-[17px] font-semibold text-nuit shadow-or"
            >
              Commencer
            </Link>
            <p className="mt-4 text-center text-[12px] leading-relaxed text-estompe">
              Deux minutes de questions, et CinéMood te connaît mieux qu’un algorithme de catalogue.
            </p>
          </motion.div>
        </footer>
      </div>
    </main>
  );
}

/** Logo original : un obturateur stylisé, dessiné en SVG. */
function Logo() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" role="img" aria-label="Logo CinéMood">
      <defs>
        <linearGradient id="degrade-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0DFBB" />
          <stop offset="60%" stopColor="#D8BD85" />
          <stop offset="100%" stopColor="#9C8355" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="none" stroke="url(#degrade-logo)" strokeWidth="1.4" />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <path
          key={angle}
          d="M20 20 L20 4 A16 16 0 0 1 33.9 12 Z"
          fill="url(#degrade-logo)"
          opacity={0.16 + (angle / 360) * 0.5}
          transform={`rotate(${angle} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="4.6" fill="#07060A" />
    </svg>
  );
}
