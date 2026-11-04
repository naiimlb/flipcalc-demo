"use client";

import { useEffect } from "react";
import { m as motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

/**
 * Décor de fond : lueurs néon (bleu électrique, corail, violet) en léger parallaxe et trame de points discrète.
 * Dégradés radiaux uniquement (pas de filtre de flou) pour rester fluide sur iPad.
 */
const GLOWS = [
  { color: "var(--neon-blue)", size: "70vmax", left: "-22vmax", top: "-26vmax", depth: 1 },
  { color: "var(--neon-coral)", size: "56vmax", left: "62%", top: "38%", depth: 0.7 },
  { color: "var(--neon-violet)", size: "46vmax", left: "18%", top: "78%", depth: 0.5 },
];

export function Backdrop() {
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 40, damping: 20 });
  const y = useSpring(pointerY, { stiffness: 40, damping: 20 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      pointerX.set(e.clientX / window.innerWidth - 0.5);
      pointerY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerX, pointerY, reduce]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgb(var(--fg) / 0.07) 1px, transparent 1.4px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at 50% 30%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, #000 20%, transparent 75%)",
        }}
      />
      {GLOWS.map((g, i) => (
        <Glow key={i} {...g} x={x} y={y} />
      ))}
    </div>
  );
}

function Glow({
  color,
  size,
  left,
  top,
  depth,
  x,
  y,
}: (typeof GLOWS)[number] & { x: ReturnType<typeof useSpring>; y: ReturnType<typeof useSpring> }) {
  const tx = useTransform(x, (v) => v * 50 * depth);
  const ty = useTransform(y, (v) => v * 36 * depth);
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        left,
        top,
        width: size,
        height: size,
        x: tx,
        y: ty,
        background: `radial-gradient(closest-side, rgb(${color} / var(--glow-strength)), transparent)`,
      }}
    />
  );
}
