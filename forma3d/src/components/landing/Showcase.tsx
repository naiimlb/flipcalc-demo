"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Design } from "@/lib/design/schema";
import { DEFAULT_VIEWER_SETTINGS, viewerBackgroundCss } from "../viewer/settings";
import { Spinner } from "../icons";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), { ssr: false });

/**
 * Exemples de solutions en 3D (page d'accueil). Le moteur 3D se charge après l'affichage de la page,
 * quand la zone est visible, ou dès que l'on touche à la page.
 */
export function Showcase({ examples }: { examples: { title: string; category: string; design: Design }[] }) {
  const [index, setIndex] = useState(0);
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || armed) return;
    let cancelled = false;
    const arm = () => !cancelled && setArmed(true);
    const start = () => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(arm, { timeout: 2000 });
      else setTimeout(arm, 300);
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      if (document.readyState === "complete") start();
      else window.addEventListener("load", start, { once: true });
    });
    observer.observe(el);
    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("pointerdown", arm);
    };
  }, [armed]);

  // Défilement automatique des exemples.
  useEffect(() => {
    if (examples.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % examples.length), 7000);
    return () => clearInterval(timer);
  }, [examples.length]);

  const current = examples[index];
  if (!current) return null;
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={ref}
        className="relative h-[46dvh] min-h-[280px] overflow-hidden rounded-[28px] shadow-card lg:h-[56dvh]"
        style={{ background: viewerBackgroundCss("neon") }}
      >
        {armed ? (
          <ModelViewer design={current.design} settings={{ ...DEFAULT_VIEWER_SETTINGS, showGrid: false }} focusId={null} onFocusChange={() => {}} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Spinner size={22} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl bg-black/30 px-4 py-2.5 text-white backdrop-blur">
          <p className="text-sm font-semibold">{current.title}</p>
          <p className="text-[11px] text-white/80">{current.category}</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5" role="tablist">
        {examples.map((e, i) => (
          <button
            key={e.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${i === index ? "bg-white text-brand-accent" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            {e.title}
          </button>
        ))}
      </div>
    </div>
  );
}
