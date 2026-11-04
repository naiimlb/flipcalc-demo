"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

type OrientationPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Scène du héros : le titre (rendu par le serveur) s'affiche tout de suite ; la 3D ne se charge qu'à la première
 * interaction (souris, doigt, clavier, défilement).
 * Le pointeur, le doigt et l'inclinaison de l'appareil alimentent la même position (-1 à 1).
 */
export function HeroStage({ children, tiltLabel }: { children: React.ReactNode; tiltLabel: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const pointer = useRef({ x: 0, y: 0 });
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [askTilt, setAskTilt] = useState(false);

  // Le moteur 3D (le plus gros script du site) ne se charge qu'à la première interaction : souris, doigt, clavier ou défilement.
  // Tant que personne n'a touché la page, le titre et les lueurs suffisent : l'affichage reste instantané, même sur un
  // téléphone modeste ou une connexion lente, et rien n'est téléchargé en pure perte (mode « économie de données » compris).
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const events = ["pointerdown", "pointermove", "touchstart", "keydown", "wheel", "scroll"] as const;
    let armedOnce = false;
    const arm = () => {
      if (armedOnce) return;
      armedOnce = true;
      for (const name of events) window.removeEventListener(name, arm);
      // Après l'interaction, on laisse le navigateur finir ce qu'il fait avant de charger la scène.
      if ("requestIdleCallback" in window) window.requestIdleCallback(() => setArmed(true), { timeout: 1200 });
      else setTimeout(() => setArmed(true), 200);
    };
    if (saveData) return;
    for (const name of events) window.addEventListener(name, arm, { passive: true, once: false });
    return () => {
      for (const name of events) window.removeEventListener(name, arm);
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
      <div aria-hidden className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}>
        {armed && <HeroScene pointer={pointer} reduceMotion={reduceMotion} onReady={() => setReady(true)} />}
      </div>
      {children}
      {askTilt && ready && (
        <button
          type="button"
          onClick={requestTilt}
          className="btn-secondary tap absolute bottom-[calc(env(safe-area-inset-bottom)+20px)] start-4 z-20 !text-xs"
        >
          {tiltLabel}
        </button>
      )}
    </>
  );
}
