"use client";

import { useEffect, useRef } from "react";

/**
 * Apparition douce au défilement, en CSS : pas de moteur d'animation à charger pour la page d'accueil.
 * Le contenu est visible dès le rendu serveur ; seuls les blocs encore hors écran sont masqués puis révélés
 * à leur arrivée (désactivé si « réduire les animations » est activé).
 */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    el.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        el.dataset.reveal = "shown";
        observer.disconnect();
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}
