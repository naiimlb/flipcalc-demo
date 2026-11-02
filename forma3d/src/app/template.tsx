"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

// Premier affichage : aucun effet (le contenu rendu par le serveur reste visible tout de suite).
let hydrated = false;

/**
 * Transition douce entre les pages (fondu, désactivé si le système demande de réduire les animations).
 * Pas de déplacement : une transformation sur ce conteneur décalerait les éléments en position fixe (décor, dialogues).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const animate = hydrated;
  useEffect(() => {
    hydrated = true;
  }, []);
  return (
    <motion.div initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
