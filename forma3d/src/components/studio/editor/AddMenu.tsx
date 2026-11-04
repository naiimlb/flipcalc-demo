"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NewShape } from "@/lib/design/ops";
import { useT } from "../../app/Preferences";

const SHAPES: NewShape[] = ["box", "cylinder", "sphere", "cone", "torus", "tube"];

const ICON: Record<NewShape | "text" | "draw", string> = {
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  cylinder: "M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3v12c0 1.7-3.1 3-7 3s-7-1.3-7-3zM5 6c0 1.7 3.1 3 7 3s7-1.3 7-3",
  sphere: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12c3 2 15 2 18 0",
  cone: "M12 3l7 15c0 1.7-3.1 3-7 3s-7-1.3-7-3zM5 18c0-1.7 3.1-3 7-3s7 1.3 7 3",
  torus: "M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6zM12 10c2 0 3.5.9 3.5 2s-1.5 2-3.5 2-3.5-.9-3.5-2 1.5-2 3.5-2z",
  tube: "M6 6c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5v12c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5zM9 6c0 .6 1.3 1 3 1s3-.4 3-1-1.3-1-3-1-3 .4-3 1z",
  text: "M5 6h14M12 6v13M9 19h6",
  draw: "M4 18c3-8 6 2 9-6s5-3 7-6M4 20h16",
};

/** Menu « Ajouter » de la barre d'outils : formes simples, texte (relief ou gravé), forme libre tracée au doigt ou au Pencil. */
export function AddMenu({ open, onClose, onShape, onText, onDraw }: { open: boolean; onClose(): void; onShape(shape: NewShape): void; onText(): void; onDraw(): void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-add-toggle]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  const item = (key: NewShape | "text" | "draw", label: string, run: () => void) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      onClick={() => {
        run();
        onClose();
      }}
      className="tap flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold text-ink-soft hover:bg-paper hover:text-ink"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
        <path d={ICON[key]} />
      </svg>
      {label}
    </button>
  );
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          aria-label={t("editor.add")}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          className="absolute start-14 top-2 z-40 grid w-64 grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-float sm:start-16"
        >
          {SHAPES.map((s) => item(s, t(`shape.${s === "box" ? "cube" : s}`), () => onShape(s)))}
          {item("text", t("add.text"), onText)}
          {item("draw", t("add.draw"), onDraw)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
