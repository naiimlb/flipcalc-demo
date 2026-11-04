"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";

/**
 * Info-bulle : nom de l'outil et raccourci clavier. Apparaît au survol (après un court délai) et au focus clavier,
 * jamais au toucher (le nom reste annoncé par l'aria-label du bouton). Rendue dans <body> pour ne pas être coupée.
 */
export function Tooltip({ label, shortcut, side = "bottom", children }: { label: string; shortcut?: string; side?: Side; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const x = side === "left" ? r.left - 8 : side === "right" ? r.right + 8 : r.left + r.width / 2;
        const y = side === "top" ? r.top - 8 : side === "bottom" ? r.bottom + 8 : r.top + r.height / 2;
        setPos({ x, y });
      }, delay);
    },
    [side],
  );
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }, []);
  useEffect(() => () => hide(), [hide]);

  const translate = { top: "-50%, -100%", bottom: "-50%, 0", left: "-100%, -50%", right: "0, -50%" }[side];
  return (
    <span
      ref={ref}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && show(400)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        // Focus au clavier uniquement (pas après un clic).
        if ((e.target as HTMLElement).matches?.(":focus-visible")) show(0);
      }}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      {pos &&
        createPortal(
          <span
            aria-hidden
            className="pointer-events-none fixed z-[100] flex items-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink shadow-float"
            style={{ left: pos.x, top: pos.y, transform: `translate(${translate})` }}
          >
            {label}
            {shortcut && <kbd className="rounded border border-line bg-paper px-1 font-mono text-xs leading-4 text-ink-mute">{shortcut}</kbd>}
          </span>,
          document.body,
        )}
    </span>
  );
}
