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
    <div className="grid w-full items-stretch gap-4 lg:grid-cols-[minmax(220px,0.7fr)_2fr] lg:gap-6">
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none lg:flex-col lg:overflow-visible" role="tablist">
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
              className={`group flex min-h-11 w-full shrink-0 items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors ${
                i === index ? "border-line bg-surface text-ink" : "border-transparent text-ink-mute hover:bg-paper hover:text-ink"
              }`}
            >
              <span className={`font-mono text-xs ${i === index ? "text-accent" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block truncate text-base font-medium">{e.title}</span>
                <span className="block truncate text-xs text-ink-mute">{e.category}</span>
              </span>
            </button>
        ))}
      </div>
      <div
        ref={ref}
        onPointerDown={() => setPaused(true)}
        className="relative h-[48dvh] min-h-[320px] w-full overflow-hidden rounded-lg border border-line bg-paper lg:h-[56dvh]"
      >
        {armed ? (
          <ModelViewer design={current.design} settings={{ ...DEFAULT_VIEWER_SETTINGS, showGrid: false }} focusId={null} onFocusChange={() => {}} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-mute">
            <Spinner size={22} />
          </div>
        )}
      </div>
    </div>
  );
}
