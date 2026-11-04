"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import type { NewShape } from "@/lib/design/ops";
import { useT } from "../../app/Preferences";
import { IconCone, IconCube, IconCylinder, IconDraw, IconSphere, IconText, IconTorus } from "../../icons";

const SHAPES: NewShape[] = ["box", "cylinder", "sphere", "cone", "torus", "tube"];

const ICON: Record<NewShape | "text" | "draw", React.ReactNode> = {
  box: <IconCube size={20} />,
  cylinder: <IconCylinder size={20} />,
  sphere: <IconSphere size={20} />,
  cone: <IconCone size={20} />,
  torus: <IconTorus size={20} />,
  tube: <IconCylinder size={20} />,
  text: <IconText size={20} />,
  draw: <IconDraw size={20} />,
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
      className="tap flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs text-ink-soft transition-colors hover:bg-paper hover:text-ink"
    >
      {ICON[key]}
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
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          className="menu absolute start-12 top-2 z-40 grid w-60 grid-cols-3 gap-0.5"
        >
          {SHAPES.map((s) => item(s, t(`shape.${s === "box" ? "cube" : s}`), () => onShape(s)))}
          {item("text", t("add.text"), onText)}
          {item("draw", t("add.draw"), onDraw)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
