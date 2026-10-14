"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
};

/** Feuille qui glisse depuis le bas (fermeture par glissement vers le bas). */
export function Sheet({ open, onClose, children, label }: Props) {
  const [mounted, setMounted] = useState(false);
  const controls = useDragControls();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-[28px] bg-elevated shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {/* Poignée : seule zone qui déplace la feuille, le contenu reste défilable. */}
            <div
              className="flex shrink-0 touch-none justify-center pb-2 pt-3"
              onPointerDown={(e) => controls.start(e)}
              aria-hidden
            >
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
              {children}
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
