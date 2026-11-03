"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

export interface LandingSection {
  id: string;
  label: string;
}

/**
 * Repères de la page d'accueil : indicateur de progression vertical à gauche (une étape par section)
 * et bouton rond en bas à droite (section suivante, puis retour en haut).
 */
export function LandingChrome({ sections, railLabel, nextLabel, topLabel }: { sections: LandingSection[]; railLabel: string; nextLabel: string; topLabel: string }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });
  const dash = useTransform(progress, (v) => 151 * (1 - v));

  useEffect(() => {
    const elements = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = sections.findIndex((s) => s.id === entry.target.id);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const go = (index: number) => {
    const el = document.getElementById(sections[index]?.id ?? "");
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const last = active >= sections.length - 1;

  return (
    <>
      <nav aria-label={railLabel} className="fixed start-3 top-1/2 z-40 hidden -translate-y-1/2 md:block lg:start-6">
        <ol className="relative flex flex-col">
          <span aria-hidden className="absolute bottom-[22px] start-[21px] top-[22px] w-px bg-fg/15" />
          <motion.span
            aria-hidden
            className="absolute start-[21px] top-[22px] w-px origin-top bg-gradient-to-b from-neon-blue via-neon-violet to-neon-coral"
            style={{ bottom: 22, scaleY: progress }}
          />
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === active ? "step" : undefined}
                className="group relative flex h-11 items-center gap-3 rounded-full pe-3 text-start"
              >
                <span className="flex h-11 w-11 items-center justify-center">
                  <span
                    className={`block rounded-full transition-all duration-300 ${
                      i === active ? "h-3 w-3 bg-fg shadow-[0_0_0_4px_rgb(var(--neon-blue)/0.35)]" : i < active ? "h-2 w-2 bg-fg/60" : "h-2 w-2 bg-fg/25"
                    }`}
                  />
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] transition-opacity duration-300 ${
                    // Sur le héros, le titre occupe toute la largeur : seuls les points restent visibles.
                    i === active && active > 0 ? "text-fg opacity-100" : "text-fg/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                >
                  <span className="me-1.5 tabular-nums text-fg/40">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => (last ? window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }) : go(active + 1))}
        aria-label={last ? topLabel : nextLabel}
        title={last ? topLabel : nextLabel}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-fg text-canvas shadow-[0_12px_40px_-12px_rgb(var(--neon-blue)/0.8)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue sm:end-6"
      >
        <svg aria-hidden className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgb(var(--canvas) / 0.18)" strokeWidth="2" />
          <motion.circle cx="28" cy="28" r="24" fill="none" stroke="rgb(var(--neon-coral))" strokeWidth="2" strokeLinecap="round" strokeDasharray="151" style={{ strokeDashoffset: dash }} />
        </svg>
        <motion.svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: last ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <path d="M12 5v14M6 13l6 6 6-6" />
        </motion.svg>
      </button>
    </>
  );
}
