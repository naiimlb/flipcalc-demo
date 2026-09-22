'use client';

/* =====================================================================
   Layout de l'application connectée : barre d'onglets + garde-fous.
   ---------------------------------------------------------------------
   Deux étapes sont obligatoires avant d'accéder à l'app :
     1. choisir ses plateformes (sinon aucune recommandation n'a de sens) ;
     2. passer le test de personnalité.
   Ce layout redirige tant que ce n'est pas fait.
   ===================================================================== */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BarreOnglets } from '@/components/BarreOnglets';
import { useApp } from '@/lib/etat/magasin';

export default function LayoutApplication({ children }: { children: React.ReactNode }) {
  const { pret, plateformesChoisies, testTermine } = useApp();
  const routeur = useRouter();

  useEffect(() => {
    if (!pret) return;
    if (!plateformesChoisies) routeur.replace('/bienvenue/plateformes');
    else if (!testTermine) routeur.replace('/bienvenue/test');
  }, [pret, plateformesChoisies, testTermine, routeur]);

  if (!pret) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-or/25 border-t-or" />
        <span className="sr-only">Chargement…</span>
      </div>
    );
  }

  if (!plateformesChoisies || !testTermine) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-8 text-center">
        <p className="text-cendre">On termine ton installation…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-lueur" aria-hidden="true" />
      <main className="page relative mx-auto max-w-xl">{children}</main>
      <BarreOnglets />
    </div>
  );
}
