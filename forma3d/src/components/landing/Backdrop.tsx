"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";

/** Sphères translucides en parallaxe (souris + défilement), sur le dégradé de la page. */
const SPHERES = [
  { size: 330, left: "4%", top: "16%", depth: 1.0, float: 14, delay: 0 },
  { size: 92, left: "77%", top: "33%", depth: 0.55, float: 10, delay: 1.2 },
  { size: 210, left: "82%", top: "72%", depth: 0.8, float: 18, delay: 0.6 },
  { size: 70, left: "14%", top: "78%", depth: 0.4, float: 8, delay: 2 },
  { size: 150, left: "52%", top: "92%", depth: 0.7, float: 12, delay: 1.6 },
];

export function Backdrop() {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 50, damping: 20 });
  const y = useSpring(pointerY, { stiffness: 50, damping: 20 });
  const { scrollY } = useScroll();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerX.set(e.clientX / window.innerWidth - 0.5);
      pointerY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerX, pointerY]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Trame de points discrète */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1.6px)",
          backgroundSize: "140px 140px",
        }}
      />
      {/* Halo central */}
      <div className="absolute left-1/2 top-[70%] h-[70vh] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,110,210,0.35),transparent)] blur-2xl" />
      {SPHERES.map((s, i) => (
        <Sphere key={i} {...s} x={x} y={y} scrollY={scrollY} />
      ))}
    </div>
  );
}

function Sphere({
  size,
  left,
  top,
  depth,
  float,
  delay,
  x,
  y,
  scrollY,
}: (typeof SPHERES)[number] & { x: MotionValue<number>; y: MotionValue<number>; scrollY: MotionValue<number> }) {
  const px = useTransform(x, (v) => v * 60 * depth);
  const pyPointer = useTransform(y, (v) => v * 40 * depth);
  const pyScroll = useTransform(scrollY, (v) => -v * 0.25 * depth);
  const py = useTransform([pyPointer, pyScroll] as MotionValue<number>[], ([a, b]: number[]) => a + b);

  return (
    <motion.div className="absolute" style={{ left, top, x: px, y: py, width: size, height: size }}>
      <motion.div
        className="cell-sphere h-full w-full"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -float, 0] }}
        transition={{
          opacity: { duration: 1.2, delay: delay * 0.3 },
          scale: { duration: 1.2, delay: delay * 0.3 },
          y: { duration: 6 + depth * 3, repeat: Infinity, ease: "easeInOut", delay },
        }}
      />
    </motion.div>
  );
}

/** Deux sphères au premier plan, à cheval sur le bord de la carte (grands écrans uniquement). */
export function FrontSpheres() {
  const { scrollY } = useScroll();
  const slow = useTransform(scrollY, (v) => v * -0.12);
  const fast = useTransform(scrollY, (v) => v * -0.22);
  const float = (distance: number, duration: number) => ({
    animate: { y: [0, -distance, 0] },
    transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
  });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden xl:block">
      <motion.div className="absolute -left-36 top-16 h-[300px] w-[300px]" style={{ y: slow }}>
        <motion.div className="cell-sphere h-full w-full" {...float(14, 7)} />
      </motion.div>
      <motion.div className="absolute -right-10 top-[420px] h-24 w-24" style={{ y: fast }}>
        <motion.div className="cell-sphere h-full w-full" {...float(8, 5)} />
      </motion.div>
    </div>
  );
}
