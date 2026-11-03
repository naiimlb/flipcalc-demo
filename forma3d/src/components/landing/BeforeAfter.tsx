"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Avant / après : une photo (illustrée) d'un bureau aux câbles emmêlés, puis la même scène avec
 * la pièce conçue par Forma3D. On compare en glissant le doigt, la souris ou avec les flèches du clavier.
 */
export function BeforeAfter({ labels }: { labels: { before: string; after: string; compare: string; beforeCaption: string; afterCaption: string } }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [rtl, setRtl] = useState(false);
  useEffect(() => setRtl(document.documentElement.dir === "rtl"), []);

  const setFromX = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (clientX - rect.left) / rect.width;
    setPos(Math.round(Math.max(0, Math.min(1, rtl ? 1 - ratio : ratio)) * 100));
  };

  return (
    <div className="w-full">
      <div
        ref={box}
        className="relative aspect-[16/10] w-full touch-pan-y select-none overflow-hidden rounded-3xl bg-night sm:aspect-[16/8]"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && setFromX(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <Scene after />
        <div className="absolute inset-0" style={{ clipPath: rtl ? `inset(0 0 0 ${100 - pos}%)` : `inset(0 ${100 - pos}% 0 0)` }}>
          <Scene after={false} />
        </div>
        <span className="chip absolute start-4 top-4 bg-black/60 text-white backdrop-blur">{labels.before}</span>
        <span className="chip absolute end-4 top-4 bg-neon-blue text-white">{labels.after}</span>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80" style={{ insetInlineStart: `${pos}%` }}>
          <button
            type="button"
            role="slider"
            aria-label={labels.compare}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pos}
            aria-valuetext={`${pos} %`}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 4;
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") setPos((p) => Math.max(0, p - step));
              else if (e.key === "ArrowRight" || e.key === "ArrowUp") setPos((p) => Math.min(100, p + step));
              else if (e.key === "Home") setPos(0);
              else if (e.key === "End") setPos(100);
              else return;
              e.preventDefault();
            }}
            className="pointer-events-auto absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-night shadow-float focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue rtl:translate-x-1/2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-between gap-4 text-xs text-fg/60 sm:text-sm">
        <span>{labels.beforeCaption}</span>
        <span className="text-end">{labels.afterCaption}</span>
      </div>
    </div>
  );
}

const CABLES = ["#ff6b4a", "#f4f5fa", "#2f6bff", "#8b5cf6", "#ffb020"];

/** Scène illustrée (vue de dessus d'un coin de bureau, éclairage de lampe). */
function Scene({ after }: { after: boolean }) {
  return (
    <svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={`lamp-${after}`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={after ? "#2a3350" : "#3a3128"} />
          <stop offset="1" stopColor="#0b0c12" />
        </radialGradient>
        <linearGradient id="desk-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b4634" />
          <stop offset="1" stopColor="#2c2119" />
        </linearGradient>
        <linearGradient id="comb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d7aff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="800" height="420" fill={`url(#lamp-${after})`} />
      {/* Plateau du bureau et chant */}
      <rect x="0" y="0" width="800" height="250" fill="#8a6a4f" opacity="0.55" />
      <rect x="0" y="250" width="800" height="18" fill="url(#desk-edge)" />
      <rect x="0" y="268" width="800" height="152" fill="#08090d" />
      {/* Ordinateur et lampe, communs aux deux vues */}
      <rect x="470" y="40" width="250" height="150" rx="10" fill="#1b1d26" />
      <rect x="482" y="52" width="226" height="126" rx="4" fill={after ? "#1e3a8a" : "#3b2f2a"} opacity="0.8" />
      <circle cx="120" cy="70" r="34" fill="#22242e" />
      <circle cx="120" cy="70" r="16" fill="#fff6dd" opacity="0.8" />
      {after ? (
        <g>
          {/* Peigne range-câbles imprimé : les câbles restent sur le bureau, rangés */}
          <rect x="250" y="188" width="230" height="46" rx="14" fill="url(#comb)" />
          <rect x="250" y="188" width="230" height="10" rx="5" fill="#fff" opacity="0.25" />
          {CABLES.map((c, i) => (
            <g key={c}>
              <rect x={272 + i * 42} y="180" width="18" height="40" rx="6" fill="#0d0f18" opacity="0.6" />
              <path d={`M${281 + i * 42} 200 C ${281 + i * 42} 150, ${300 + i * 60} 110, ${360 + i * 70} 95`} stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" />
              <rect x={274 + i * 42} y="232" width="14" height="22" rx="3" fill="#d7dae4" />
            </g>
          ))}
          <ellipse cx="365" cy="246" rx="140" ry="8" fill="#000" opacity="0.35" />
        </g>
      ) : (
        <g>
          {/* Câbles qui glissent et pendent derrière le bureau */}
          {CABLES.map((c, i) => (
            <path
              key={c}
              d={`M${330 + i * 30} 120 C ${260 + i * 50} 200, ${420 - i * 40} 230, ${300 + i * 36} 262 S ${250 + i * 70} 360, ${330 + i * 28} 410`}
              stroke={c}
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
              opacity="0.92"
            />
          ))}
          <path d="M300 300 q 40 30 90 -6 q 40 -20 70 20" stroke="#f4f5fa" strokeWidth="6" fill="none" opacity="0.6" />
        </g>
      )}
      {/* Grain photo */}
      <rect width="800" height="420" fill="#000" opacity="0.08" />
    </svg>
  );
}
