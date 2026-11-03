"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Scène du héros : le titre (rendu par le serveur) s'affiche tout de suite ; la 3D se charge ensuite,
 * quand la page est prête et le navigateur au repos, ou dès que l'on touche l'écran.
 * Le pointeur, le doigt et l'inclinaison de l'appareil alimentent la même position (-1 à 1).
 */
export function HeroStage({ children, tiltLabel }: { children: React.ReactNode; tiltLabel: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const pointer = useRef({ x: 0, y: 0 });
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [askTilt, setAskTilt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const arm = () => !cancelled && setArmed(true);
    const start = () => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(arm, { timeout: 2500 });
      else setTimeout(arm, 400);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      window.removeEventListener("pointerdown", arm);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const set = (cx: number, cy: number) => {
      pointer.current.x = (cx / window.innerWidth) * 2 - 1;
      pointer.current.y = -((cy / window.innerHeight) * 2 - 1);
    };
    const onPointer = (e: PointerEvent) => set(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => e.touches[0] && set(e.touches[0].clientX, e.touches[0].clientY);
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      pointer.current.x = Math.max(-1, Math.min(1, e.gamma / 30));
      pointer.current.y = Math.max(-1, Math.min(1, -(e.beta - 45) / 30));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    // Inclinaison : directe sur Android ; sur iPhone et iPad, Safari demande une autorisation (bouton dédié).
    const Orientation = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as (typeof DeviceOrientationEvent & OrientationPermission) | undefined;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (Orientation && coarse) {
      if (typeof Orientation.requestPermission === "function") setAskTilt(true);
      else window.addEventListener("deviceorientation", onOrientation, { passive: true });
    }
    const enableTilt = () => window.addEventListener("deviceorientation", onOrientation, { passive: true });
    window.addEventListener("forma3d:tilt", enableTilt);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("forma3d:tilt", enableTilt);
    };
  }, [reduceMotion]);

  const requestTilt = async () => {
    const Orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & OrientationPermission;
    try {
      const result = await Orientation.requestPermission?.();
      if (result === "granted") window.dispatchEvent(new Event("forma3d:tilt"));
    } catch {
      // Refus ou navigateur sans capteur : les objets réagissent toujours au doigt.
    }
    setAskTilt(false);
  };

  return (
    <>
      {/* Lueurs de repli, visibles pendant le chargement de la 3D (et sans WebGL). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -start-[10%] top-[18%] h-[38vmax] w-[38vmax] rounded-full bg-[radial-gradient(closest-side,rgb(var(--neon-blue)/0.28),transparent)]" />
        <div className="absolute -end-[8%] bottom-[8%] h-[34vmax] w-[34vmax] rounded-full bg-[radial-gradient(closest-side,rgb(var(--neon-coral)/0.22),transparent)]" />
      </div>
      <div aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
        {armed && <HeroScene pointer={pointer} reduceMotion={reduceMotion} onReady={() => setReady(true)} />}
      </div>
      {children}
      {askTilt && ready && (
        <button
          type="button"
          onClick={requestTilt}
          className="btn-line tap absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] start-4 z-20 !py-2 !text-xs backdrop-blur"
        >
          {tiltLabel}
        </button>
      )}
    </>
  );
}
