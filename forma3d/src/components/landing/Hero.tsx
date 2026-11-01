"use client";

import { motion } from "framer-motion";
import { IconCube } from "../icons";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Titre XXL avec pastille noire au milieu (textes modifiables dans /admin/apparence). */
export function Hero({
  pill,
  title,
  line2,
  subtitle,
}: {
  pill: string;
  title: string;
  line2: string;
  subtitle: string;
}) {
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: EASE },
  });

  return (
    <div className="mx-auto max-w-4xl text-center">
      <h1 className="text-[clamp(2.1rem,7vw,4.6rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-[0.28em] gap-y-2">
          {pill && (
            <motion.span
              {...rise(0.05)}
              className="inline-flex items-center gap-[0.25em] rounded-full bg-ink px-[0.45em] py-[0.08em] text-white"
            >
              {pill}
              <motion.span
                className="inline-flex"
                animate={{ rotate: [0, 12, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <IconCube size={46} strokeWidth={1.5} className="h-[0.7em] w-[0.7em]" />
              </motion.span>
            </motion.span>
          )}
          <motion.span {...rise(0.15)}>{title}</motion.span>
        </span>
        {line2 && (
          <motion.span {...rise(0.25)} className="mt-1 block">
            {line2}
          </motion.span>
        )}
      </h1>
      <motion.p {...rise(0.38)} className="mx-auto mt-5 max-w-2xl text-[clamp(1rem,2.2vw,1.35rem)] leading-snug text-ink-mute">
        {subtitle}
      </motion.p>
    </div>
  );
}
