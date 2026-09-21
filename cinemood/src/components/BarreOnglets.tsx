'use client';

/* =====================================================================
   BarreOnglets.tsx — Navigation principale, en bas de l'écran.
   ---------------------------------------------------------------------
   En bas parce que l'app doit s'utiliser d'une main, pouce compris.
   La barre respecte la zone sûre iOS pour ne pas passer sous la barre
   d'accueil de l'iPhone.
   ===================================================================== */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

interface Onglet {
  href: string;
  libelle: string;
  chemin: string;
}

const ONGLETS: Onglet[] = [
  {
    href: '/accueil',
    libelle: 'Accueil',
    chemin: 'M3 11.2 12 4l9 7.2M5.6 9.6V20h12.8V9.6',
  },
  {
    href: '/decouvrir',
    libelle: 'Découvrir',
    chemin: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2',
  },
  {
    href: '/ma-liste',
    libelle: 'Ma liste',
    chemin: 'M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z',
  },
  {
    href: '/profil',
    libelle: 'Profil',
    chemin: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.3-3.6 4.1-5.5 7.5-5.5s6.2 1.9 7.5 5.5',
  },
];

export function BarreOnglets() {
  const chemin = usePathname();

  return (
    <nav
      className="verre-fort fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto flex max-w-xl items-stretch">
        {ONGLETS.map((onglet) => {
          const actif = chemin === onglet.href || chemin.startsWith(`${onglet.href}/`);
          return (
            <li key={onglet.href} className="flex-1">
              <Link
                href={onglet.href}
                aria-current={actif ? 'page' : undefined}
                className="relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 pt-1"
              >
                {actif && (
                  <motion.span
                    layoutId="onglet-actif"
                    className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-voile-or"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <svg
                  viewBox="0 0 24 24"
                  className={`h-[22px] w-[22px] transition-colors ${actif ? 'text-orClair' : 'text-estompe'}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={onglet.chemin} />
                </svg>
                <span
                  className={`text-[10.5px] tracking-wide transition-colors ${
                    actif ? 'text-orClair' : 'text-estompe'
                  }`}
                >
                  {onglet.libelle}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
