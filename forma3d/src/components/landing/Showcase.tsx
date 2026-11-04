"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Design } from "@/lib/design/schema";
import { DEFAULT_VIEWER_SETTINGS } from "../viewer/settings";
import { Spinner } from "../icons";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), { ssr: false });

/**
 * Exemples de solutions en 3D (page d'accueil), en pleine largeur : liste à gauche, vue 3D manipulable à droite.
 * Le moteur 3D ne se charge que lorsque la section approche de l'écran.
 */
export function Showcase({ examples }: { examples: { title: string; category: string; design: Design }[] }) {
  const [index, setIndex] = useState(0);
  const [armed, setArmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || armed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        setArmed(true);
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [armed]);

  // Défilement automatique des exemples, interrompu dès que l'on manipule le modèle.
  useEffect(() => {
    if (examples.length < 2 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % examples.length), 8000);
    return () => clearInterval(timer);
  }, [examples.length, paused]);

  const current = examples[index];
  if (!current) return null;
  return (
    <div className="grid w-full items-center gap-6 lg:grid-cols-[minmax(260px,0.8fr)_2fr] lg:gap-12">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:flex-col lg:gap-1 lg:overflow-visible" role="tablist">
        {examples.map((e, i) => (
            <button
              key={e.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => {
                setIndex(i);
                setPaused(true);
              }}
              className={`group flex min-h-11 w-full shrink-0 items-center gap-4 rounded-2xl px-4 py-3 text-start transition ${
                i === index ? "bg-fg/[0.07] text-fg" : "text-fg/55 hover:text-fg"
              }`}
            >
              <span className={`font-display text-sm font-black tabular-nums ${i === index ? "text-neon" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block truncate text-base font-bold tracking-tight lg:text-lg">{e.title}</span>
                <span className="block truncate text-xs text-fg/50">{e.category}</span>
              </span>
            </button>
        ))}
      </div>
      <div
        ref={ref}
        onPointerDown={() => setPaused(true)}
        className="relative h-[52dvh] min-h-[320px] w-full overflow-hidden rounded-lg bg-[radial-gradient(circle_at_30%_20%,rgb(var(--neon-blue)/0.22),transparent_55%),radial-gradient(circle_at_80%_90%,rgb(var(--neon-coral)/0.18),transparent_55%)] ring-1 ring-fg/10 lg:h-[64dvh]"
      >
        {armed ? (
          <ModelViewer design={current.design} settings={{ ...DEFAULT_VIEWER_SETTINGS, showGrid: false }} focusId={null} onFocusChange={() => {}} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-fg/60">
            <Spinner size={22} />
          </div>
        )}
      </div>
    </div>
  );
}
