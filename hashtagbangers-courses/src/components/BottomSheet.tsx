import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Pied de feuille collé en bas (boutons d'action). */
  footer?: ReactNode;
  tall?: boolean;
}

export const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const;

export function BottomSheet({ open, onClose, title, children, footer, tall }: Props) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-[30px] bg-white dark:bg-night-card shadow-[0_-12px_40px_rgba(0,0,0,0.18)] ${
              tall ? 'h-[92dvh]' : 'max-h-[90dvh]'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) onClose();
            }}
          >
            <div
              className="touch-none-select flex shrink-0 cursor-grab flex-col items-center px-5 pt-2.5 pb-1"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => controls.start(e)}
            >
              <div className="h-[5px] w-10 rounded-full bg-black/15 dark:bg-white/20" />
              {title && (
                <div className="mt-3 flex w-full items-center justify-between gap-3">
                  <h2 className="font-display text-[26px] uppercase leading-none tracking-wide">{title}</h2>
                  <button
                    onClick={onClose}
                    className="press -mr-1 grid h-10 w-10 place-items-center rounded-full bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/70"
                    aria-label="Fermer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="scroll-area min-h-0 flex-1 px-5 pt-2 pb-4">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-black/5 px-5 pt-3 dark:border-white/10" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
                {footer}
              </div>
            )}
            {!footer && <div style={{ height: 'var(--safe-bottom)' }} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
