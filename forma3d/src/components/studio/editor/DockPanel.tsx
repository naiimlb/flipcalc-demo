"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { IconX } from "../../icons";

const MIN = 220;
const MAX = 520;

function readWidth(key: string, fallback: number) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n >= MIN && n <= MAX ? n : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Panneau latéral de l'éditeur.
 * Grand écran (Mac) : ancré, redimensionnable à la souris, au trackpad ou au clavier (flèches sur la poignée).
 * iPad / iPhone : tiroir qui glisse par-dessus la vue 3D, fermé par le bouton, Échap ou un toucher à côté.
 */
export function DockPanel({
  side,
  docked,
  open,
  onClose,
  title,
  storageKey,
  defaultWidth,
  closeLabel,
  resizeLabel,
  children,
}: {
  side: "left" | "right";
  docked: boolean;
  open: boolean;
  onClose(): void;
  title: string;
  storageKey: string;
  defaultWidth: number;
  closeLabel: string;
  resizeLabel: string;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const drag = useRef<{ x: number; w: number } | null>(null);
  useEffect(() => setWidth(readWidth(storageKey, defaultWidth)), [storageKey, defaultWidth]);
  const save = useCallback(
    (w: number) => {
      const next = Math.round(Math.min(MAX, Math.max(MIN, w)));
      setWidth(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // ignoré
      }
    },
    [storageKey],
  );

  useEffect(() => {
    if (docked || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [docked, open, onClose]);

  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  // Le tiroir « gauche » est côté début de ligne : à droite de l'écran en arabe.
  const offscreen = (side === "left") !== rtl ? "-100%" : "100%";

  if (docked) {
    if (!open) return null;
    // Sens de la poignée : vers l'extérieur de l'écran = plus large (inversé en arabe).
    const sign = (side === "left" ? 1 : -1) * (rtl ? -1 : 1);
    return (
      <aside aria-label={title} className={`editor-dock relative flex min-h-0 shrink-0 flex-col bg-surface ${side === "left" ? "border-e" : "border-s"} border-line`} style={{ width }}>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={resizeLabel}
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, w: width };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current) save(drag.current.w + (e.clientX - drag.current.x) * sign);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onDoubleClick={() => save(defaultWidth)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") save(width - 16 * sign);
            else if (e.key === "ArrowRight") save(width + 16 * sign);
            else return;
            e.preventDefault();
          }}
          className={`group absolute inset-y-0 z-10 flex w-2 cursor-col-resize items-center justify-center outline-none ${side === "left" ? "-end-1" : "-start-1"}`}
        >
          <span className="h-full w-px bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent" />
        </div>
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="absolute inset-0 z-30 bg-night/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            aria-label={title}
            role="dialog"
            aria-modal="false"
            className={`editor-dock absolute inset-y-0 z-40 flex w-[min(360px,92vw)] flex-col bg-surface shadow-float ${side === "left" ? "start-0 border-e" : "end-0 border-s"} border-line`}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <button type="button" onClick={onClose} aria-label={closeLabel} className="icon-btn tap">
                <IconX size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+12px)] scrollbar-thin">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
