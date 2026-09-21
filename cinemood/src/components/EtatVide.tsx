'use client';

/* =====================================================================
   EtatVide.tsx — Quand il n'y a rien à montrer, on explique et on agit.
   ---------------------------------------------------------------------
   Un écran vide sans explication donne le sentiment d'une app cassée.
   Ici, chaque cas vide propose une action concrète : élargir les
   filtres, ajouter une plateforme, relancer.
   ===================================================================== */

import { Bouton } from './Boutons';

interface Props {
  titre: string;
  message: string;
  actionLibelle?: string;
  onAction?: () => void;
  secondaireLibelle?: string;
  onSecondaire?: () => void;
}

export function EtatVide({ titre, message, actionLibelle, onAction, secondaireLibelle, onSecondaire }: Props) {
  return (
    <div className="mx-auto max-w-sm px-8 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full verre">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-or/70" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M4 5.5h16v13H4zM4 9.5h16M8 5.5v4M16 5.5v4" />
        </svg>
      </div>
      <h2 className="font-titre text-2xl text-ivoire">{titre}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-cendre">{message}</p>
      <div className="mt-7 space-y-3">
        {actionLibelle && onAction && (
          <Bouton variante="or" pleineLargeur onClick={onAction}>
            {actionLibelle}
          </Bouton>
        )}
        {secondaireLibelle && onSecondaire && (
          <Bouton variante="fantome" pleineLargeur onClick={onSecondaire}>
            {secondaireLibelle}
          </Bouton>
        )}
      </div>
    </div>
  );
}
