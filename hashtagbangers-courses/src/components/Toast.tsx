import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

let push: ((t: ToastData) => void) | null = null;
let counter = 0;

export function toast(message: string, opts: { actionLabel?: string; onAction?: () => void } = {}) {
  push?.({ id: ++counter, message, ...opts });
}

export function ToastHost() {
  const [current, setCurrent] = useState<ToastData | null>(null);

  useEffect(() => {
    push = setCurrent;
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => setCurrent(null), current.actionLabel ? 4500 : 2400);
    return () => window.clearTimeout(t);
  }, [current]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: 'calc(var(--tabbar-h) + 16px)' }}
    >
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="pointer-events-auto flex min-h-12 w-full max-w-[420px] items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2.5 text-[15px] font-medium text-white shadow-xl dark:bg-white dark:text-ink"
            role="status"
          >
            <span>{current.message}</span>
            {current.actionLabel && (
              <button
                className="press -mr-1 rounded-xl px-3 py-2 font-display text-[15px] uppercase tracking-wide text-brand-200 dark:text-brand"
                onClick={() => {
                  current.onAction?.();
                  setCurrent(null);
                }}
              >
                {current.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
