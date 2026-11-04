"use client";

import { useEffect } from "react";

// Premier affichage : aucun effet (le contenu rendu par le serveur reste visible tout de suite).
let hydrated = false;

/**
 * Transition douce entre les pages (fondu en CSS, désactivé si le système demande de réduire les animations).
 * Pas de déplacement : une transformation sur ce conteneur décalerait les éléments en position fixe (décor, dialogues).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const animate = hydrated;
  useEffect(() => {
    hydrated = true;
  }, []);
  return <div className={animate ? "page-enter" : undefined}>{children}</div>;
}
