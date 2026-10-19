"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#10b981", "#0ea5a4", "#2563eb", "#f59e0b", "#a7f3d0"];

/** Célébration légère : quelques confettis qui tombent puis disparaissent. */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const reduced = useReducedMotion();
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.8 + Math.random() * 1.4,
        rotate: (Math.random() - 0.5) * 720,
        drift: (Math.random() - 0.5) * 120,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
      })),
    [pieces],
  );
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {items.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: p.color,
            borderRadius: p.round ? "999px" : "2px",
          }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: p.drift, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
